/**
 * Client-side wrappers for Slingshot and Constellation APIs.
 */

import { fetchJson } from "./api";

const SLINGSHOT = "https://slingshot.microcosm.blue/xrpc";
const CONSTELLATION = "https://constellation.microcosm.blue/xrpc";

export interface MiniDoc {
  did: string;
  handle: string;
  pds?: string;
}

interface BacklinkRef {
  did: string;
  collection: string;
  rkey: string;
}

interface BacklinksResponse {
  total: number;
  records: BacklinkRef[];
  cursor?: string;
}

export interface ATRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

interface ListRecordsResponse {
  records: { uri: string; cid: string; value: Record<string, unknown> }[];
  cursor?: string;
}

export function parseAtUri(uri: string): { did: string; collection: string; rkey: string } {
  const parts = uri.split("/");
  return { did: parts[2], collection: parts[3], rkey: parts[4] };
}

export async function resolveIdentity(identifier: string): Promise<MiniDoc> {
  return fetchJson<MiniDoc>(
    `${SLINGSHOT}/blue.microcosm.identity.resolveMiniDoc?identifier=${encodeURIComponent(identifier)}`,
  );
}

export async function resolveIdentitiesBatch(
  dids: string[],
): Promise<Record<string, MiniDoc>> {
  const unique = [...new Set(dids)];
  const results = await Promise.allSettled(unique.map(resolveIdentity));
  const map: Record<string, MiniDoc> = {};
  for (const r of results) {
    if (r.status === "fulfilled") map[r.value.did] = r.value;
  }
  return map;
}

export async function getRecord(
  did: string,
  collection: string,
  rkey: string,
): Promise<ATRecord> {
  return fetchJson<ATRecord>(
    `${SLINGSHOT}/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`,
  );
}

export async function getRecordsBatch(
  refs: BacklinkRef[],
): Promise<ATRecord[]> {
  const results = await Promise.allSettled(
    refs.map((r) => getRecord(r.did, r.collection, r.rkey)),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<ATRecord> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function getBacklinks(
  subject: string,
  source: string,
  limit = 25,
): Promise<BacklinksResponse> {
  return fetchJson<BacklinksResponse>(
    `${CONSTELLATION}/blue.microcosm.links.getBacklinks?subject=${encodeURIComponent(subject)}&source=${encodeURIComponent(source)}&limit=${limit}`,
  );
}

export async function listRecords(
  pdsUrl: string,
  did: string,
  collection: string,
  limit = 20,
): Promise<{ uri: string; value: Record<string, unknown> }[]> {
  try {
    const data = await fetchJson<ListRecordsResponse>(
      `${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}&limit=${limit}`,
    );
    return data.records;
  } catch {
    return [];
  }
}
