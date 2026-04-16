/** Fetch the user's own root posts (threads) across all BBSes. */

import { listRecords, resolveIdentitiesBatch } from "./atproto";
import { POST } from "./lexicon";
import { parseAtUri } from "./util";
import { is } from "@atcute/lexicons/validations";
import { mainSchema as postSchema } from "../lexicons/types/xyz/atbbs/post";
import type { XyzAtbbsPost } from "../lexicons";

export interface MyThread {
  uri: string;
  rkey: string;
  title: string;
  body: string;
  createdAt: string;
  bbsDid: string;
  bbsHandle: string;
}

export async function fetchMyThreads(
  pdsUrl: string,
  did: string,
): Promise<MyThread[]> {
  const records = await listRecords(pdsUrl, did, POST);
  const rootPosts = records
    .filter((record) => is(postSchema, record.value))
    .filter((record) => {
      const value = record.value as Record<string, unknown>;
      return !value.root && value.title; // root posts with titles = threads
    });
  if (!rootPosts.length) return [];

  const bbsDids = new Set(
    rootPosts.map((record) => {
      const value = record.value as unknown as XyzAtbbsPost.Main;
      return parseAtUri(value.scope).did;
    }),
  );
  const identities = await resolveIdentitiesBatch([...bbsDids]);

  const results: MyThread[] = [];
  for (const record of rootPosts) {
    const value = record.value as unknown as XyzAtbbsPost.Main;
    const bbsDid = parseAtUri(value.scope).did;
    const identity = identities[bbsDid];
    if (!identity) continue;
    results.push({
      uri: record.uri,
      rkey: parseAtUri(record.uri).rkey,
      title: value.title ?? "",
      body: value.body,
      createdAt: value.createdAt,
      bbsDid,
      bbsHandle: identity.handle,
    });
  }
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results;
}
