import { SERVICES } from "../config";
import { fetchJson, malformed } from "./transport";

const CONSTELLATION = SERVICES.constellation;

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
}

export async function getBacklinks(
  subject: string,
  source: string,
  { limit = 50, cursor, did }: BacklinkOptions = {},
): Promise<BacklinkPage> {
  let url = `${CONSTELLATION}/blue.microcosm.links.getBacklinks?subject=${encodeURIComponent(subject)}&source=${encodeURIComponent(source)}&limit=${limit}`;
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

export async function getBacklinkCount(subject: string, source: string) {
  const { total } = await fetchJson<{ total: number }>(
    `${CONSTELLATION}/blue.microcosm.links.getBacklinksCount?subject=${encodeURIComponent(subject)}&source=${encodeURIComponent(source)}`,
  );
  if (typeof total !== "number") malformed("Backlink count service");
  return total;
}
