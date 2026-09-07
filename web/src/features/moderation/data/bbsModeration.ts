/** Lookup tables for a BBS's moderation state: who is banned, which posts
 *  are hidden, and the rkeys of those records (so the sysop can undo). */

import { listRecords, requireComplete } from "../../../atproto/records";
import { BAN, HIDE } from "../../../atbbs/schema/collections";
import { parseAtUri } from "../../../atproto/uri";
import { isBanRecord, isHideRecord } from "../../../shared/protocol/recordGuards";

// Fields must be JSON-safe — this shape is persisted via localStorage.
export interface BBSModeration {
  /** DID → rkey of that user's ban record on the sysop's PDS. */
  banRkeys: Record<string, string[]>;
  /** Post URI → rkey of its hide record on the sysop's PDS. */
  hideRkeys: Record<string, string[]>;
}

export async function fetchBBSModeration(
  pdsUrl: string,
  did: string,
): Promise<BBSModeration> {
  const [banResult, hideResult] = await Promise.all([
    listRecords(pdsUrl, did, BAN),
    listRecords(pdsUrl, did, HIDE),
  ]);
  const banRecs = requireComplete(banResult);
  const hideRecs = requireComplete(hideResult);

  const banRkeys: Record<string, string[]> = {};
  for (const record of banRecs) {
    if (!isBanRecord(record)) continue;
    (banRkeys[record.value.did] ??= []).push(parseAtUri(record.uri).rkey);
  }

  const hideRkeys: Record<string, string[]> = {};
  for (const record of hideRecs) {
    if (!isHideRecord(record)) continue;
    (hideRkeys[record.value.uri] ??= []).push(parseAtUri(record.uri).rkey);
  }

  return { banRkeys, hideRkeys };
}
