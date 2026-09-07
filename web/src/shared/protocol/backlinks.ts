import { SERVICES } from "../config/shared";
import { parseAtUri } from "./uri";
import { resolveIdentitiesBatch } from "./identities";
import { getRecordsBatch } from "./records";
import { fetchJson, malformed } from "./transport";

const CONSTELLATION = SERVICES.constellation;

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
  ) {
    malformed("Backlink service");
  }
  return response;
}

export async function getBacklinkCount(subject: string, source: string) {
  const { total } = await fetchJson<{ total: number }>(
    `${CONSTELLATION}/blue.microcosm.links.getBacklinksCount?subject=${encodeURIComponent(subject)}&source=${encodeURIComponent(source)}`,
  );
  if (typeof total !== "number") malformed("Backlink count service");
  return total;
}

export async function getBacklinkCountsBatch(
  subjects: string[],
  source: string,
) {
  const unique = [...new Set(subjects)];
  const counts = await Promise.all(
    unique.map((subject) => getBacklinkCount(subject, source)),
  );
  return Object.fromEntries(
    unique.map((subject, index) => [subject, counts[index]]),
  );
}

interface HydratedRecord {
  uri: string;
  did: string;
  rkey: string;
  handle: string;
  pds: string;
  value: Record<string, unknown>;
}

export async function fetchAndHydrate(
  subject: string,
  source: string,
  options?: {
    limit?: number;
    cursor?: string;
    excludeDid?: string;
    failureMode?: "strict" | "best-effort";
  },
): Promise<{ records: HydratedRecord[]; cursor: string | null }> {
  const backlinks = await getBacklinks(
    subject,
    source,
    options?.limit ?? 50,
    options?.cursor,
  );
  if (!backlinks.records.length) return { records: [], cursor: null };
  const records = await getRecordsBatch(backlinks.records, {
    failureMode: options?.failureMode,
  });
  const filtered = records.filter(
    (record) => parseAtUri(record.uri).did !== options?.excludeDid,
  );
  if (!filtered.length) {
    return { records: [], cursor: backlinks.cursor ?? null };
  }
  const identities = await resolveIdentitiesBatch(
    filtered.map((record) => parseAtUri(record.uri).did),
  );
  const hydrated = filtered.flatMap((record): HydratedRecord[] => {
    const { did, rkey } = parseAtUri(record.uri);
    const identity = identities[did];
    return identity
      ? [
          {
            uri: record.uri,
            did,
            rkey,
            handle: identity.handle,
            pds: identity.pds ?? "",
            value: record.value,
          },
        ]
      : [];
  });
  return { records: hydrated, cursor: backlinks.cursor ?? null };
}
