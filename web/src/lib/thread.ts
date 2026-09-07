/** Thread detail fetchers: root post, reply refs, and the hydrated
 *  reply records for one page of the thread. */

import { getBacklinks, type BacklinkRef } from "../shared/protocol/backlinks";
import { resolveIdentitiesBatch, resolveIdentity } from "../shared/protocol/identities";
import { getRecord, getRecordsBatch } from "../shared/protocol/records";
import { POST } from "../shared/config/lexicon";
import { parseAtUri } from "../shared/protocol/uri";
import { recordToReply } from "./replies";
import { isPostRecord } from "./recordGuards";
import type { Reply } from "./replies";

export interface ThreadRoot {
  uri: string;
  did: string;
  rkey: string;
  authorHandle: string;
  authorPds: string;
  title: string;
  body: string;
  createdAt: string;
  boardSlug: string;
  attachments?: { file: { ref: { $link: string } }; name: string }[];
}

const MAX_REF_PAGES = 20;
const REF_PAGE_SIZE = 100;

/** Every reply ref for the thread, oldest-first. */
export async function fetchThreadRefs(
  threadUri: string,
): Promise<{
  items: BacklinkRef[];
  truncated: boolean;
  nextCursor: string | null;
}> {
  const collected: BacklinkRef[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  let truncated = false;
  for (let i = 0; i < MAX_REF_PAGES; i++) {
    const page = await getBacklinks(
      threadUri,
      `${POST}:root`,
      REF_PAGE_SIZE,
      cursor,
    );
    collected.push(...page.records.slice(0, 2_000 - collected.length));
    if (!page.cursor) break;
    if (seenCursors.has(page.cursor) || collected.length >= 2_000) {
      cursor = page.cursor;
      truncated = true;
      break;
    }
    seenCursors.add(page.cursor);
    cursor = page.cursor;
  }
  return { items: collected.reverse(), truncated, nextCursor: cursor ?? null };
}

export async function fetchThreadRoot(
  bbsDid: string,
  did: string,
  tid: string,
): Promise<ThreadRoot> {
  const threadRecord = await getRecord(did, POST, tid);
  if (!isPostRecord(threadRecord)) {
    throw new Error("Invalid post record");
  }
  const author = await resolveIdentity(did);
  const postValue = threadRecord.value;
  const scope = parseAtUri(postValue.scope);
  if (
    threadRecord.value.root ||
    scope.did !== bbsDid ||
    scope.collection !== "xyz.atbbs.board"
  ) {
    throw new Error("Thread does not belong to this BBS");
  }
  await getRecord(bbsDid, "xyz.atbbs.board", scope.rkey);
  const boardSlug = scope.rkey;
  return {
    uri: threadRecord.uri,
    did,
    rkey: tid,
    authorHandle: author.handle,
    authorPds: author.pds ?? "",
    title: postValue.title ?? "",
    body: postValue.body,
    createdAt: postValue.createdAt,
    boardSlug,
    attachments: postValue.attachments as ThreadRoot["attachments"],
  };
}

export interface ReplyPage {
  replies: Reply[];
  /** Lookup by URI for any reply referenced as a parent — includes both
   *  on-page replies and off-page parents fetched separately. */
  parentReplies: Record<string, Reply>;
}

export async function hydrateReplyPage(
  threadUri: string,
  pageRefs: BacklinkRef[],
): Promise<ReplyPage> {
  if (!pageRefs.length) return { replies: [], parentReplies: {} };

  const records = (await getRecordsBatch(pageRefs)).filter(
    (record) => isPostRecord(record) && record.value.root === threadUri,
  );
  const authors = await resolveIdentitiesBatch(
    records.map((r) => parseAtUri(r.uri).did),
  );
  const replies: Reply[] = records
    .map((record) => recordToReply(record, authors))
    .filter((reply): reply is Reply => reply !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const parentReplies: Record<string, Reply> = {};
  for (const reply of replies) parentReplies[reply.uri] = reply;

  const offPageParentUris = [
    ...new Set(
      replies
        .map((r) => r.parent)
        .filter((uri): uri is string => !!uri && !parentReplies[uri]),
    ),
  ];
  if (offPageParentUris.length) {
    const parentRefs = offPageParentUris.map((uri) => parseAtUri(uri));
    const parentRecords = await getRecordsBatch(parentRefs);
    const parentAuthors = await resolveIdentitiesBatch(
      parentRecords.map((r) => parseAtUri(r.uri).did),
    );
    for (const record of parentRecords) {
      const reply = recordToReply(record, parentAuthors);
      if (reply) parentReplies[reply.uri] = reply;
    }
  }

  return { replies, parentReplies };
}
