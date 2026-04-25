/** Lookup tables for a BBS's moderation state: who is banned, which posts
 *  are hidden, and the rkeys of those records (so the sysop can undo). */

import { listRecords } from "./atproto";
import { BAN, HIDE } from "./lexicon";
import { parseAtUri } from "./util";
import { isBanRecord, isHideRecord } from "./recordGuards";

// Fields must be JSON-safe — this shape is persisted via localStorage.
export interface BBSModeration {
  /** DID → rkey of that user's ban record on the sysop's PDS. */
  banRkeys: Record<string, string>;
  /** Post URI → rkey of its hide record on the sysop's PDS. */
  hideRkeys: Record<string, string>;
}

export async function fetchBBSModeration(
  pdsUrl: string,
  did: string,
): Promise<BBSModeration> {
  const [banRecs, hideRecs] = await Promise.all([
    listRecords(pdsUrl, did, BAN).catch(() => []),
    listRecords(pdsUrl, did, HIDE).catch(() => []),
  ]);

  const banRkeys: Record<string, string> = {};
  for (const record of banRecs) {
    if (!isBanRecord(record)) continue;
    banRkeys[record.value.did] = parseAtUri(record.uri).rkey;
  }

  const hideRkeys: Record<string, string> = {};
  for (const record of hideRecs) {
    if (!isHideRecord(record)) continue;
    hideRkeys[record.value.uri] = parseAtUri(record.uri).rkey;
  }

  return { banRkeys, hideRkeys };
}
