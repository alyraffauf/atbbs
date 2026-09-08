/** Build a page of thread summaries for a board, sorted by last activity.
 *
 *  Scans recent board activity (threads + replies) from Constellation and
 *  collects unique thread URIs in the order they appear. Since Constellation
 *  returns newest posts first, the first time a thread URI appears is its
 *  most recent activity — giving us bump order naturally. */

import {
  getBacklinks,
  makeAtUri,
  parseAtUri,
  type AuthenticatedRepo,
} from "@atbbs/atproto";
import { getAvatars, resolveIdentitiesBatch } from "../identity/service";
import { getBacklinkCountsBatch } from "../discussion/hydration";
import { getRecordsBatch, getRecordsByUri } from "../support/records";
import { BOARD, POST } from "../config";
import type { Did } from "@atcute/lexicons/syntax";
import { isPostRecord } from "../schema/records";
import {
  getPostModeration,
  type PublicReadOptions,
} from "../moderation/policy";
import type { PostRecord } from "../schema/records";
import type { PendingAttachment } from "./attachments";
import { createPost } from "./posts";

export interface CreateThreadInput {
  communityDid: string;
  boardSlug: string;
  title: string;
  body: string;
  attachments: PendingAttachment[];
}

export function createThread(
  repo: AuthenticatedRepo,
  pdsUrl: string,
  input: CreateThreadInput,
) {
  return createPost(repo, pdsUrl, {
    scope: makeAtUri(input.communityDid as Did, BOARD, input.boardSlug),
    title: input.title,
    body: input.body,
    attachments: input.attachments,
  });
}

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

export interface ThreadPageOptions extends PublicReadOptions {
  cursor?: string;
}

const MAX_SCANS = 4;
const PAGE_SIZE = 25;

export async function hydrateThreadPage(
  bbsDid: string,
  slug: string,
  options: ThreadPageOptions = {},
): Promise<ThreadPageResult> {
  const { cursor, moderation, viewerDid, ...requestOptions } = options;
  const boardUri = makeAtUri(bbsDid as Did, BOARD, slug);

  const lastActivity = new Map<string, string>();
  const postersByThread = new Map<string, Set<string>>();
  const rootsByUri = new Map<string, PostRecord>();
  let scanCursor = cursor;
  const seenCursors = new Set<string>();

  for (let scan = 0; scan < MAX_SCANS; scan++) {
    if (lastActivity.size >= PAGE_SIZE) break;

    const backlinks = await getBacklinks(boardUri, `${POST}:scope`, {
      limit: PAGE_SIZE - lastActivity.size,
      cursor: scanCursor,
      ...requestOptions,
    });
    if (!backlinks.records.length) break;

    const remaining = PAGE_SIZE - lastActivity.size;
    const records = await getRecordsBatch(
      backlinks.records.slice(0, remaining),
      requestOptions,
    );
    const visibleActivity = records.filter(isPostRecord).filter((record) => {
      if (!moderation) return true;
      const did = parseAtUri(record.uri).did;
      return getPostModeration(
        moderation,
        { uri: record.uri, did },
        viewerDid,
        bbsDid,
      ).isVisible;
    });
    const candidateThreadUris = [
      ...new Set(
        visibleActivity
          .map((record) => record.value.root ?? record.uri)
          .filter((uri) => !rootsByUri.has(uri)),
      ),
    ];
    const candidateRoots = await getRecordsByUri(candidateThreadUris, {
      failureMode: "best-effort",
      ...requestOptions,
    });
    for (const root of candidateRoots) {
      if (!isPostRecord(root) || !root.value.title || root.value.root) continue;
      const scope = parseAtUri(root.value.scope);
      const did = parseAtUri(root.uri).did;
      if (
        scope.did !== bbsDid ||
        scope.collection !== BOARD ||
        scope.rkey !== slug ||
        (moderation &&
          !getPostModeration(
            moderation,
            { uri: root.uri, did },
            viewerDid,
            bbsDid,
          ).isVisible)
      ) {
        continue;
      }
      rootsByUri.set(root.uri, root);
    }

    for (const record of visibleActivity) {
      if (lastActivity.size >= PAGE_SIZE) break;
      const threadUri = record.value.root ?? record.uri;
      if (!rootsByUri.has(threadUri)) continue;
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
  const validRoots = threadUris.flatMap((uri) => {
    const record = rootsByUri.get(uri);
    return record ? [record] : [];
  });

  const allDids = new Set<string>();
  for (const record of validRoots) {
    allDids.add(parseAtUri(record.uri).did);
    const posters = postersByThread.get(record.uri);
    if (posters) for (const did of posters) allDids.add(did);
  }

  const [identities, replyCounts, avatars] = await Promise.all([
    resolveIdentitiesBatch([...allDids], requestOptions),
    getBacklinkCountsBatch(
      validRoots.map((record) => record.uri),
      `${POST}:root`,
      requestOptions,
    ),
    getAvatars([...allDids], requestOptions),
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
