/** Build a page of thread summaries for a board, sorted by last activity.
 *
 *  Scans recent board activity (threads + replies) from Constellation and
 *  collects unique thread URIs in the order they appear. Since Constellation
 *  returns newest posts first, the first time a thread URI appears is its
 *  most recent activity — giving us bump order naturally. */

import { getBacklinks } from "../../atproto/backlinks";
import { getAvatars, resolveIdentitiesBatch } from "../identity/service";
import { getBacklinkCountsBatch } from "../discussion/hydration";
import { getRecordsBatch, getRecordsByUri } from "../support/records";
import { POST, BOARD } from "../schema/collections";
import { makeAtUri, parseAtUri } from "../../atproto/uri";
import type { Did } from "@atcute/lexicons/syntax";
import { isPostRecord } from "../schema/records";

export interface Participant {
  did: string;
  handle: string;
  avatar?: string;
}

export interface ThreadSummary {
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
  threads: ThreadSummary[];
  cursor: string | null;
}

const MAX_SCANS = 4;
const PAGE_SIZE = 25;

export async function hydrateThreadPage(
  bbsDid: string,
  slug: string,
  cursor?: string,
): Promise<ThreadPageResult> {
  const boardUri = makeAtUri(bbsDid as Did, BOARD, slug);

  const lastActivity = new Map<string, string>();
  const postersByThread = new Map<string, Set<string>>();
  let scanCursor = cursor;
  const seenCursors = new Set<string>();

  for (let scan = 0; scan < MAX_SCANS; scan++) {
    if (lastActivity.size >= PAGE_SIZE) break;

    const backlinks = await getBacklinks(
      boardUri,
      `${POST}:scope`,
      PAGE_SIZE - lastActivity.size,
      scanCursor,
    );
    if (!backlinks.records.length) break;

    const remaining = PAGE_SIZE - lastActivity.size;
    const records = await getRecordsBatch(
      backlinks.records.slice(0, remaining),
    );
    for (const record of records) {
      if (lastActivity.size >= PAGE_SIZE) break;
      if (!isPostRecord(record)) continue;
      const threadUri = record.value.root ?? record.uri;
      if (!lastActivity.has(threadUri)) {
        lastActivity.set(threadUri, record.value.createdAt);
      }
      let posters = postersByThread.get(threadUri);
      if (!posters) {
        posters = new Set();
        postersByThread.set(threadUri, posters);
      }
      posters.add(parseAtUri(record.uri).did);
    }

    scanCursor = backlinks.cursor ?? undefined;
    if (!scanCursor || seenCursors.has(scanCursor)) break;
    seenCursors.add(scanCursor);
  }

  const threadUris = [...lastActivity.keys()].slice(0, PAGE_SIZE);
  // Constellation can retain backlinks to deleted roots, and Slingshot may
  // report those missing records as a server error. Keep the rest of the
  // board usable when one stale root cannot be hydrated.
  const rootRecords = await getRecordsByUri(threadUris, {
    failureMode: "best-effort",
  });

  const validRoots = rootRecords.filter(isPostRecord).filter((record) => {
    if (!record.value.title || record.value.root) return false;
    const scope = parseAtUri(record.value.scope);
    return (
      scope.did === bbsDid && scope.collection === BOARD && scope.rkey === slug
    );
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

  const threads: ThreadSummary[] = validRoots
    .filter((record) => parseAtUri(record.uri).did in identities)
    .map((record) => {
      const { did, rkey } = parseAtUri(record.uri);
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
        title: record.value.title ?? "",
        body: record.value.body,
        createdAt: record.value.createdAt,
        lastActivityAt: lastActivity.get(record.uri) ?? record.value.createdAt,
        replyCount: replyCounts[record.uri] ?? 0,
        participants,
      };
    })
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

  return { threads, cursor: scanCursor ?? null };
}
