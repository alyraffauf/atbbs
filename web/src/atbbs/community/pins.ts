/** Fetch and resolve the user's pinned BBSes. */

import { getAvatars, resolveIdentitiesBatch } from "../identity/service";
import {
  listRecords,
  requireComplete,
} from "../../atproto/records";
import { getRecordsByUri } from "../support/records";
import { PIN, SITE } from "../schema/collections";
import { isPinRecord, isSiteRecord } from "../schema/records";
import { makeAtUri, parseAtUri } from "../../atproto/uri";
import type { Did } from "@atcute/lexicons/syntax";

export interface PinnedCommunity {
  did: string;
  rkey: string;
  handle: string;
  name: string;
  createdAt: string;
  avatar?: string;
}

export async function fetchPins(
  pdsUrl: string,
  did: string,
): Promise<PinnedCommunity[]> {
  const records = requireComplete(await listRecords(pdsUrl, did, PIN));
  const pinRecords = records.filter(isPinRecord);

  const pinnedDids = pinRecords.map((record) => record.value.did);
  if (!pinnedDids.length) return [];

  const [identities, siteResults, avatars] = await Promise.all([
    resolveIdentitiesBatch(pinnedDids),
    getRecordsByUri(
      pinnedDids.map((pinnedDid) => makeAtUri(pinnedDid as Did, SITE, "self")),
      { failureMode: "best-effort" },
    ),
    getAvatars(pinnedDids),
  ]);

  const siteNames: Record<string, string> = {};
  siteResults.forEach((record) => {
    if (!isSiteRecord(record)) return;
    siteNames[parseAtUri(record.uri).did] = record.value.name;
  });

  const results: PinnedCommunity[] = [];
  for (const record of pinRecords) {
    const identity = identities[record.value.did];
    if (!identity) continue;
    results.push({
      did: record.value.did,
      rkey: parseAtUri(record.uri).rkey,
      handle: identity.handle,
      name: siteNames[record.value.did] ?? identity.handle,
      createdAt: record.value.createdAt,
      avatar: avatars[record.value.did],
    });
  }
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results;
}

export function findPinRkey(
  pins: PinnedCommunity[],
  targetDid: string,
): string | null {
  const match = pins.find((entry) => entry.did === targetDid);
  return match ? match.rkey : null;
}
