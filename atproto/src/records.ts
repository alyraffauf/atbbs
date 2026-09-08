import { parseAtUri } from "./uri";
import { fetchJson, malformed, type RequestOptions } from "./transport";
import { DEFAULT_SLINGSHOT_URL } from "./services";

export interface ATRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

export interface BoundedResult<T> {
  items: T[];
  truncated: boolean;
  nextCursor: string | null;
}

export interface RecordRequestOptions extends RequestOptions {
  serviceUrl?: string;
}

export interface ListRecordsOptions extends RequestOptions {
  pageSize?: number;
  maxRecords?: number;
  maxPages?: number;
  reverse?: boolean;
}

function isRecord(value: unknown): value is ATRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ATRecord>;
  return (
    typeof record.uri === "string" &&
    typeof record.cid === "string" &&
    !!record.value &&
    typeof record.value === "object"
  );
}

export async function getRecord(
  did: string,
  collection: string,
  rkey: string,
  {
    serviceUrl = DEFAULT_SLINGSHOT_URL,
    ...requestOptions
  }: RecordRequestOptions = {},
): Promise<ATRecord> {
  const record = await fetchJson<ATRecord>(
    `${serviceUrl}/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`,
    requestOptions,
  );
  if (!isRecord(record)) {
    malformed("Record service");
  }
  return record;
}

export function getRecordByUri(
  uri: string,
  options: RecordRequestOptions = {},
) {
  const { did, collection, rkey } = parseAtUri(uri);
  return getRecord(did, collection, rkey, options);
}

export async function listRecords(
  pdsUrl: string,
  did: string,
  collection: string,
  {
    pageSize = 100,
    maxRecords = 10_000,
    maxPages = 100,
    reverse = false,
    ...requestOptions
  }: ListRecordsOptions = {},
): Promise<BoundedResult<ATRecord>> {
  const records: ATRecord[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  for (let page = 0; page < maxPages; page++) {
    const remaining = maxRecords - records.length;
    if (remaining <= 0) {
      return { items: records, truncated: true, nextCursor: cursor ?? null };
    }
    const limit = Math.min(pageSize, remaining);
    let url = `${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}&limit=${limit}`;
    if (reverse) url += "&reverse=true";
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
    const data = await fetchJson<{
      records: ATRecord[];
      cursor?: string | null;
    }>(url, requestOptions);
    if (
      !data ||
      !Array.isArray(data.records) ||
      data.records.some((record) => !isRecord(record)) ||
      (data.cursor != null && typeof data.cursor !== "string")
    ) {
      malformed("PDS record listing");
    }
    records.push(...data.records.slice(0, remaining));
    if (!data.cursor) {
      return { items: records, truncated: false, nextCursor: null };
    }
    if (seenCursors.has(data.cursor)) {
      return { items: records, truncated: true, nextCursor: data.cursor };
    }
    seenCursors.add(data.cursor);
    cursor = data.cursor;
  }
  return { items: records, truncated: true, nextCursor: cursor ?? null };
}

export function requireComplete<T>(result: BoundedResult<T>): T[] {
  if (result.truncated)
    throw new Error("PDS listing exceeded its safety limit");
  return result.items;
}
