import type { LoaderFunctionArgs } from "react-router-dom";
import { resolveBBS, type BBS } from "../../lib/bbs";
import {
  getAvatars,
  getBacklinkCountsBatch,
  getBacklinks,
  getRecordsBatch,
  getRecordsByUri,
  resolveIdentitiesBatch,
} from "../../lib/atproto";
import { POST, BOARD } from "../../lib/lexicon";
import { makeAtUri, parseAtUri } from "../../lib/util";
import { is } from "@atcute/lexicons/validations";
import { mainSchema as postSchema } from "../../lexicons/types/xyz/atbbs/post";
import type { XyzAtbbsPost } from "../../lexicons";

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

const MAX_SCANS = 4;
const PAGE_SIZE = 25;

/**
 * Fetch threads for a board, sorted by last activity (bump order).
 *
 * Scans recent board activity (threads + replies) and collects unique
 * thread URIs in the order they appear. Since Constellation returns
 * newest posts first, the first time a thread URI appears is its most
 * recent activity — giving us bump order naturally.
 */
export async function hydrateThreadPage(
  bbs: BBS,
  slug: string,
  cursor?: string,
): Promise<{ threads: ThreadItem[]; cursor: string | null }> {
  const boardUri = makeAtUri(bbs.identity.did, BOARD, slug);

  // Phase 1: Scan board activity to find unique thread URIs and their posters.
  // Constellation returns newest-first, so first-seen activity per thread = most
  // recent, and Set insertion order preserves newest-first poster order.
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

  // Phase 2: Fetch root post records for the thread URIs.
  const threadUris = [...lastActivity.keys()].slice(0, PAGE_SIZE);
  const rootRecords = await getRecordsByUri(threadUris);

  const validRoots = rootRecords.filter((record) => {
    if (!is(postSchema, record.value)) return false;
    const value = record.value as unknown as XyzAtbbsPost.Main;
    return value.title && !value.root;
  });

  // Phase 3: Resolve identities+avatars for every poster across all threads,
  // count replies, and build ThreadItems.
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

export async function boardLoader({ params }: LoaderFunctionArgs) {
  const handle = params.handle!;
  const slug = params.slug!;
  const bbs = await resolveBBS(handle);
  const board = bbs.site.boards.find((board) => board.slug === slug);
  if (!board) throw new Response("Board not found", { status: 404 });

  const { threads, cursor } = await hydrateThreadPage(bbs, slug);
  return { handle, bbs, board, threads, cursor };
}
