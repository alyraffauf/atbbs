/** Build a page of thread summaries for a board, sorted by last activity.
 *
 *  Scans recent board activity (threads + replies) from Constellation and
 *  collects unique thread URIs in the order they appear. Since Constellation
 *  returns newest posts first, the first time a thread URI appears is its
 *  most recent activity — giving us bump order naturally. */

import {
  getAvatars,
  getBacklinkCountsBatch,
  getBacklinks,
  getRecordsBatch,
  getRecordsByUri,
  resolveIdentitiesBatch,
} from "./atproto";
import { POST, BOARD } from "./lexicon";
import { makeAtUri, parseAtUri } from "./util";
import { is } from "@atcute/lexicons/validations";
import { mainSchema as postSchema } from "../lexicons/types/xyz/atbbs/post";
import type { XyzAtbbsPost } from "../lexicons";

export interface Participant {
  did: string;
  handle: string;
  avatar?: string;
}

export interface ThreadItem {
  uri: string;
  did: string;
  rkey: string;
  handle: string;
  title: string;
  body: string;
  createdAt: string;
  lastActivityAt: string;
  replyCount: number;
  participants: Participant[];
}

export interface ThreadPageResult {
  threads: ThreadItem[];
  cursor: string | null;
}

const MAX_SCANS = 4;
const PAGE_SIZE = 25;

export async function hydrateThreadPage(
  bbsDid: string,
  slug: string,
  cursor?: string,
): Promise<ThreadPageResult> {
  const boardUri = makeAtUri(bbsDid, BOARD, slug);

  const lastActivity = new Map<string, string>();
  const postersByThread = new Map<string, Set<string>>();
  let scanCursor = cursor;

  for (let scan = 0; scan < MAX_SCANS; scan++) {
    if (lastActivity.size >= PAGE_SIZE) break;

    const backlinks = await getBacklinks(
      boardUri,
      `${POST}:scope`,
      100,
      scanCursor,
    );
    if (!backlinks.records.length) break;

    const records = await getRecordsBatch(backlinks.records);
    for (const record of records) {
      if (!is(postSchema, record.value)) continue;
      const value = record.value as unknown as XyzAtbbsPost.Main;
      const threadUri = value.root ?? record.uri;
      if (!lastActivity.has(threadUri)) {
        lastActivity.set(threadUri, value.createdAt);
      }
      let posters = postersByThread.get(threadUri);
      if (!posters) {
        posters = new Set();
        postersByThread.set(threadUri, posters);
      }
      posters.add(parseAtUri(record.uri).did);
    }

    scanCursor = backlinks.cursor;
    if (!scanCursor) break;
  }

  const threadUris = [...lastActivity.keys()].slice(0, PAGE_SIZE);
  const rootRecords = await getRecordsByUri(threadUris);

  const validRoots = rootRecords.filter((record) => {
    if (!is(postSchema, record.value)) return false;
    const value = record.value as unknown as XyzAtbbsPost.Main;
    return value.title && !value.root;
  });

  const allDids = new Set<string>();
  for (const record of validRoots) {
    allDids.add(parseAtUri(record.uri).did);
    const posters = postersByThread.get(record.uri);
    if (posters) for (const did of posters) allDids.add(did);
  }

  const [identities, replyCounts, avatars] = await Promise.all([
    resolveIdentitiesBatch([...allDids]),
    getBacklinkCountsBatch(
      validRoots.map((record) => record.uri),
      `${POST}:root`,
    ),
    getAvatars([...allDids]),
  ]);

  const threads: ThreadItem[] = validRoots
    .filter((record) => parseAtUri(record.uri).did in identities)
    .map((record) => {
      const { did, rkey } = parseAtUri(record.uri);
      const value = record.value as unknown as XyzAtbbsPost.Main;
      const posterDids = postersByThread.get(record.uri) ?? new Set([did]);
      const participants: Participant[] = [...posterDids]
        .filter((posterDid) => posterDid in identities)
        .map((posterDid) => ({
          did: posterDid,
          handle: identities[posterDid].handle,
          avatar: avatars[posterDid],
        }));
      return {
        uri: record.uri,
        did,
        rkey,
        handle: identities[did].handle,
        title: value.title ?? "",
        body: value.body,
        createdAt: value.createdAt,
        lastActivityAt: lastActivity.get(record.uri) ?? value.createdAt,
        replyCount: replyCounts[record.uri] ?? 0,
        participants,
      };
    })
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

  return { threads, cursor: scanCursor ?? null };
}
