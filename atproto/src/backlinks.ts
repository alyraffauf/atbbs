import { fetchJson, malformed } from "./transport";
import { DEFAULT_CONSTELLATION_URL } from "./services";

export interface BacklinkRef {
  did: string;
  collection: string;
  rkey: string;
}

export interface BacklinkPage {
  total: number;
  records: BacklinkRef[];
  cursor?: string | null;
}

export interface BacklinkOptions {
  limit?: number;
  cursor?: string;
  did?: string;
  serviceUrl?: string;
}

export async function getBacklinks(
  subject: string,
  source: string,
  {
    limit = 50,
    cursor,
    did,
    serviceUrl = DEFAULT_CONSTELLATION_URL,
  }: BacklinkOptions = {},
): Promise<BacklinkPage> {
  let url = `${serviceUrl}/blue.microcosm.links.getBacklinks?subject=${encodeURIComponent(subject)}&source=${encodeURIComponent(source)}&limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  if (did) url += `&did=${encodeURIComponent(did)}`;
  const response = await fetchJson<BacklinkPage>(url);
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

export async function getBacklinkCount(
  subject: string,
  source: string,
  serviceUrl = DEFAULT_CONSTELLATION_URL,
) {
  const { total } = await fetchJson<{ total: number }>(
    `${serviceUrl}/blue.microcosm.links.getBacklinksCount?subject=${encodeURIComponent(subject)}&source=${encodeURIComponent(source)}`,
  );
  if (typeof total !== "number") malformed("Backlink count service");
  return total;
}
