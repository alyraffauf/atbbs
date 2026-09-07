/** Fetch the user's own root posts (threads) across all BBSes. */

import { resolveIdentitiesBatch } from "../identity/service";
import { listRecords, requireComplete } from "../../atproto/records";
import { POST } from "../schema/collections";
import { parseAtUri } from "../../atproto/uri";
import { isPostRecord } from "../schema/records";

export interface OwnedThread {
  uri: string;
  rkey: string;
  threadDid: string;
  threadRkey: string;
  authorDid: string;
  title: string;
  body: string;
  createdAt: string;
  bbsDid: string;
  bbsHandle: string;
}

export async function fetchMyThreads(
  pdsUrl: string,
  did: string,
): Promise<OwnedThread[]> {
  const records = requireComplete(await listRecords(pdsUrl, did, POST));
  const rootPosts = records
    .filter(isPostRecord)
    .filter((record) => !record.value.root && record.value.title);
  if (!rootPosts.length) return [];

  const bbsDids = new Set(
    rootPosts.map((record) => parseAtUri(record.value.scope).did),
  );
  const identities = await resolveIdentitiesBatch([...bbsDids]);

  const results: OwnedThread[] = [];
  for (const record of rootPosts) {
    const bbsDid = parseAtUri(record.value.scope).did;
    const identity = identities[bbsDid];
    if (!identity) continue;
    results.push({
      uri: record.uri,
      rkey: parseAtUri(record.uri).rkey,
      threadDid: did,
      threadRkey: parseAtUri(record.uri).rkey,
      authorDid: did,
      title: record.value.title ?? "",
      body: record.value.body,
      createdAt: record.value.createdAt,
      bbsDid,
      bbsHandle: identity.handle,
    });
  }
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results;
}
