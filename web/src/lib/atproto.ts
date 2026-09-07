/** Read-side wrappers for Slingshot and Constellation (no auth needed). */

import { CDN, SERVICES } from "./shared";
import { parseAtUri } from "./util";

const SLINGSHOT = SERVICES.slingshot;
const CONSTELLATION = SERVICES.constellation;

const BSKY_PROFILE = "app.bsky.actor.profile";

// --- Types ---

export interface MiniDoc {
  did: string;
  handle: string;
  pds?: string;
}

export interface BacklinkRef {
  did: string;
  collection: string;
  rkey: string;
}

interface BacklinksResponse {
  total: number;
  records: BacklinkRef[];
  cursor?: string | null;
}

export interface ATRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

interface ListRecordsResponse {
  records: { uri: string; cid: string; value: Record<string, unknown> }[];
  cursor?: string | null;
}

export interface BoundedResult<T> {
  items: T[];
  truncated: boolean;
  nextCursor: string | null;
}

export class FetchError extends Error {
  constructor(
    public readonly kind: "not-found" | "rate-limit" | "server" | "transport" | "malformed",
    message: string,
  ) {
    super(message);
  }
}

// --- URLs ---

export function blobUrl(pds: string, did: string, cid: string): string {
  return `${pds}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
}

export function cdnImageUrl(did: string, cid: string): string {
  return `${CDN.url}/img/feed_fullsize/plain/${did}/${cid}@${CDN.image_format}`;
}

// --- Low-level JSON fetcher ---

async function fetchJson<T>(url: string): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(url);
  } catch (error) {
    throw new FetchError("transport", String(error));
  }
  if (resp.status === 404) throw new FetchError("not-found", `404 ${url}`);
  if (resp.status === 400) {
    const body = (await resp
      .clone()
      .json()
      .catch(() => null)) as { error?: unknown; message?: unknown } | null;
    const error = typeof body?.error === "string" ? body.error : "";
    const message = typeof body?.message === "string" ? body.message : "";
    if (
      error === "RecordNotFound" ||
      /could not find (?:repo|record)/i.test(message)
    ) {
      throw new FetchError("not-found", message || `400 ${url}`);
    }
  }
  if (resp.status === 429) throw new FetchError("rate-limit", `429 ${url}`);
  if (resp.status >= 500) throw new FetchError("server", `${resp.status} ${url}`);
  if (!resp.ok) throw new Error(`${resp.status} ${url}`);
  try {
    return (await resp.json()) as T;
  } catch (error) {
    throw new FetchError("malformed", String(error));
  }
}

function malformed(label: string): never {
  throw new FetchError("malformed", `${label} returned malformed data`);
}

function reportPartialFailures(
  operation: string,
  results: PromiseSettledResult<unknown>[],
): void {
  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason)
    .filter(
      (reason) => !(reason instanceof FetchError && reason.kind === "not-found"),
    );
  if (failures.length) {
    console.warn(`${operation} completed with ${failures.length} partial failure(s)`, failures);
  }
}

export interface RecordHydrationOptions {
  failureMode?: "strict" | "best-effort";
}

function collectHydratedRecords(
  results: PromiseSettledResult<ATRecord>[],
  failureMode: "strict" | "best-effort",
): ATRecord[] {
  const failures = results.filter(
    (result): result is PromiseRejectedResult =>
      result.status === "rejected" &&
      !(result.reason instanceof FetchError && result.reason.kind === "not-found"),
  );
  if (failureMode === "strict" && failures.length) {
    throw failures[0].reason;
  }
  if (failureMode === "best-effort") {
    reportPartialFailures("Record hydration", results);
  }
  return results
    .filter(
      (result): result is PromiseFulfilledResult<ATRecord> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
}

// --- Records ---

export async function getRecord(
  did: string,
  collection: string,
  rkey: string,
): Promise<ATRecord> {
  const record = await fetchJson<ATRecord>(
    `${SLINGSHOT}/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`,
  );
  if (
    !record ||
    typeof record.uri !== "string" ||
    typeof record.cid !== "string" ||
    !record.value ||
    typeof record.value !== "object"
  ) malformed("Record service");
  return record;
}

async function allSettledBounded<T, R>(
  values: T[],
  worker: (value: T) => Promise<R>,
  concurrency = 10,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(values.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await worker(values[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, run),
  );
  return results;
}

export async function getRecordByUri(uri: string): Promise<ATRecord> {
  const { did, collection, rkey } = parseAtUri(uri);
  return getRecord(did, collection, rkey);
}

export async function getRecordsByUri(
  uris: string[],
  { failureMode = "strict" }: RecordHydrationOptions = {},
): Promise<ATRecord[]> {
  const results = await allSettledBounded([...new Set(uris)], getRecordByUri);
  return collectHydratedRecords(results, failureMode);
}

export async function getRecordsBatch(
  refs: BacklinkRef[],
  { failureMode = "strict" }: RecordHydrationOptions = {},
): Promise<ATRecord[]> {
  const unique = [...new Map(refs.map((ref) => [`${ref.did}/${ref.collection}/${ref.rkey}`, ref])).values()];
  const results = await allSettledBounded(
    unique,
    (ref) => getRecord(ref.did, ref.collection, ref.rkey),
  );
  return collectHydratedRecords(results, failureMode);
}

export async function listRecords(
  pdsUrl: string,
  did: string,
  collection: string,
  pageSize = 100,
  maxRecords = 10_000,
  maxPages = 100,
  reverse = false,
): Promise<BoundedResult<ATRecord>> {
  const all: ListRecordsResponse["records"] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  for (let page = 0; page < maxPages; page++) {
    const remaining = maxRecords - all.length;
    if (remaining <= 0) return { items: all, truncated: true, nextCursor: cursor ?? null };
    const limit = Math.min(pageSize, remaining);
    let url = `${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}&limit=${limit}`;
    if (reverse) url += "&reverse=true";
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
    const data = await fetchJson<ListRecordsResponse>(url);
    if (
      !data ||
      !Array.isArray(data.records) ||
      (data.cursor != null && typeof data.cursor !== "string")
    ) malformed("PDS record listing");
    all.push(...data.records.slice(0, remaining));
    if (!data.cursor) return { items: all, truncated: false, nextCursor: null };
    if (seenCursors.has(data.cursor)) {
      return { items: all, truncated: true, nextCursor: data.cursor };
    }
    seenCursors.add(data.cursor);
    cursor = data.cursor;
  }
  return { items: all, truncated: true, nextCursor: cursor ?? null };
}

export function requireComplete<T>(result: BoundedResult<T>): T[] {
  if (result.truncated) throw new Error("PDS listing exceeded its safety limit");
  return result.items;
}

// --- Identity (DID doc) ---

export async function resolveIdentity(identifier: string): Promise<MiniDoc> {
  const identity = await fetchJson<MiniDoc>(
    `${SLINGSHOT}/blue.microcosm.identity.resolveMiniDoc?identifier=${encodeURIComponent(identifier)}`,
  );
  if (
    !identity ||
    typeof identity.did !== "string" ||
    typeof identity.handle !== "string" ||
    (identity.pds !== undefined && typeof identity.pds !== "string")
  ) malformed("Identity service");
  return identity;
}

export async function resolveIdentitiesBatch(
  ids: string[],
): Promise<Record<string, MiniDoc>> {
  const unique = [...new Set(ids)];
  const results = await allSettledBounded(unique, resolveIdentity);
  reportPartialFailures("Identity hydration", results);
  const map: Record<string, MiniDoc> = {};
  for (const result of results) {
    if (result.status === "fulfilled") map[result.value.did] = result.value;
  }
  return map;
}

// --- Avatar ---

function extractAvatarCid(value: Record<string, unknown>): string | null {
  const avatar = value.avatar as { ref?: { $link?: string } } | undefined;
  return avatar?.ref?.$link ?? null;
}

export async function getAvatar(did: string): Promise<string | null> {
  try {
    const record = await getRecord(did, BSKY_PROFILE, "self");
    const cid = extractAvatarCid(record.value);
    return cid ? `${CDN.url}/img/avatar/plain/${did}/${cid}` : null;
  } catch (error) {
    if (error instanceof FetchError && error.kind === "not-found") return null;
    throw error;
  }
}

export async function getAvatars(
  dids: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(dids)];
  const settled = await allSettledBounded(unique, getAvatar);
  reportPartialFailures("Avatar hydration", settled);
  const map: Record<string, string> = {};
  unique.forEach((did, index) => {
    const result = settled[index];
    const url = result.status === "fulfilled" ? result.value : undefined;
    if (url) map[did] = url;
  });
  return map;
}

// --- Backlinks (Constellation) ---

export async function getBacklinks(
  subject: string,
  source: string,
  limit = 50,
  cursor?: string,
  did?: string,
): Promise<BacklinksResponse> {
  let url = `${CONSTELLATION}/blue.microcosm.links.getBacklinks?subject=${encodeURIComponent(subject)}&source=${encodeURIComponent(source)}&limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  if (did) url += `&did=${encodeURIComponent(did)}`;
  const response = await fetchJson<BacklinksResponse>(url);
  if (
    !response ||
    typeof response.total !== "number" ||
    !Array.isArray(response.records) ||
    (response.cursor != null && typeof response.cursor !== "string") ||
    response.records.some(
      (record) =>
        !record ||
        typeof record.did !== "string" ||
        typeof record.collection !== "string" ||
        typeof record.rkey !== "string",
    )
  ) malformed("Backlink service");
  return response;
}

export async function getBacklinkCount(
  subject: string,
  source: string,
): Promise<number> {
  const { total } = await fetchJson<{ total: number }>(
    `${CONSTELLATION}/blue.microcosm.links.getBacklinksCount?subject=${encodeURIComponent(subject)}&source=${encodeURIComponent(source)}`,
  );
  if (typeof total !== "number") malformed("Backlink count service");
  return total;
}

export async function getBacklinkCountsBatch(
  subjects: string[],
  source: string,
): Promise<Record<string, number>> {
  const unique = [...new Set(subjects)];
  const counts = await Promise.all(
    unique.map((subject) => getBacklinkCount(subject, source)),
  );
  const map: Record<string, number> = {};
  unique.forEach((subject, index) => {
    map[subject] = counts[index];
  });
  return map;
}

// --- Fetch-and-hydrate (backlinks -> records -> identities) ---

interface HydratedRecord {
  uri: string;
  did: string;
  rkey: string;
  handle: string;
  pds: string;
  value: Record<string, unknown>;
}

interface FetchAndHydrateResult {
  records: HydratedRecord[];
  cursor: string | null;
}

export async function fetchAndHydrate(
  subject: string,
  source: string,
  opts?: {
    limit?: number;
    cursor?: string;
    excludeDid?: string;
    failureMode?: "strict" | "best-effort";
  },
): Promise<FetchAndHydrateResult> {
  const limit = opts?.limit ?? 50;
  const backlinks = await getBacklinks(subject, source, limit, opts?.cursor);
  if (!backlinks.records.length) return { records: [], cursor: null };

  const records = await getRecordsBatch(backlinks.records, {
    failureMode: opts?.failureMode,
  });

  const filtered = records.filter((record) => {
    const { did } = parseAtUri(record.uri);
    if (opts?.excludeDid && did === opts.excludeDid) return false;
    return true;
  });

  if (!filtered.length)
    return { records: [], cursor: backlinks.cursor ?? null };

  const dids = filtered.map((record) => parseAtUri(record.uri).did);
  const authors = await resolveIdentitiesBatch(dids);

  const hydrated = filtered
    .filter((record) => parseAtUri(record.uri).did in authors)
    .map((record) => {
      const { did, rkey } = parseAtUri(record.uri);
      const author = authors[did];
      return {
        uri: record.uri,
        did,
        rkey,
        handle: author.handle,
        pds: author.pds ?? "",
        value: record.value,
      };
    });

  return { records: hydrated, cursor: backlinks.cursor ?? null };
}
