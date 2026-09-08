/** Lookup tables for a BBS's moderation state: who is banned, which posts
 *  are hidden, and the rkeys of those records (so the sysop can undo). */

import {
  createRecord,
  deleteRecord,
  listRecords,
  malformed,
  parseAtUri,
  requireComplete,
  type AuthenticatedRepo,
  type RequestOptions,
} from "@atbbs/atproto";
import { BAN, HIDE } from "../config";
import { isBanRecord, isHideRecord } from "../schema/records";
import type { XyzAtbbsBan, XyzAtbbsHide } from "../lexicons";
import { nowIso } from "../support/time";

type BanValue = Omit<XyzAtbbsBan.Main, "$type">;
type HideValue = Omit<XyzAtbbsHide.Main, "$type">;

// Fields must be JSON-safe — this shape is persisted via localStorage.
export interface ModerationState {
  /** DID → rkey of that user's ban record on the sysop's PDS. */
  banRkeys: Record<string, string[]>;
  /** Post URI → rkey of its hide record on the sysop's PDS. */
  hideRkeys: Record<string, string[]>;
}

export async function fetchBBSModeration(
  pdsUrl: string,
  did: string,
  options: RequestOptions = {},
): Promise<ModerationState> {
  const [banResult, hideResult] = await Promise.all([
    listRecords(pdsUrl, did, BAN, options),
    listRecords(pdsUrl, did, HIDE, options),
  ]);
  const banRecs = requireComplete(banResult);
  const hideRecs = requireComplete(hideResult);

  const banRkeys: Record<string, string[]> = {};
  for (const record of banRecs) {
    if (!isBanRecord(record)) malformed("Ban record");
    (banRkeys[record.value.did] ??= []).push(parseAtUri(record.uri).rkey);
  }

  const hideRkeys: Record<string, string[]> = {};
  for (const record of hideRecs) {
    if (!isHideRecord(record)) malformed("Hide record");
    (hideRkeys[record.value.uri] ??= []).push(parseAtUri(record.uri).rkey);
  }

  return { banRkeys, hideRkeys };
}

async function deterministicRkey(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

export async function createBan(
  repo: AuthenticatedRepo,
  did: string,
): Promise<void> {
  const value: BanValue = {
    did: did as BanValue["did"],
    createdAt: nowIso(),
  };
  await createRecord(repo, BAN, value, await deterministicRkey(did));
}

export async function createHide(
  repo: AuthenticatedRepo,
  uri: string,
): Promise<void> {
  const value: HideValue = {
    uri: uri as HideValue["uri"],
    createdAt: nowIso(),
  };
  await createRecord(repo, HIDE, value, await deterministicRkey(uri));
}

export async function deleteBan(
  repo: AuthenticatedRepo,
  rkey: string,
): Promise<void> {
  await deleteRecord(repo, BAN, rkey);
}

export async function deleteHide(
  repo: AuthenticatedRepo,
  rkey: string,
): Promise<void> {
  await deleteRecord(repo, HIDE, rkey);
}
