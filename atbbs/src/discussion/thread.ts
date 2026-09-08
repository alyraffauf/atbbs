/** Thread detail fetchers: root post, reply refs, and the hydrated
 *  reply records for one page of the thread. */

import {
  getBacklinks,
  getRecord,
  parseAtUri,
  resolveIdentity,
  type BacklinkRef,
  type RequestOptions,
} from "@atbbs/atproto";
import { resolveIdentitiesBatch } from "../identity/service";
import { getRecordsBatch } from "../support/records";
import { POST } from "../config";
import { recordToReply } from "./replies";
import { isPostRecord, type PostRecord } from "../schema/records";
import type { Reply } from "./replies";
import { prepareAttachmentViews, type AttachmentView } from "./attachments";
import {
  getPostModeration,
  type PublicReadOptions,
} from "../moderation/policy";

export interface Thread {
  uri: string;
  did: string;
  rkey: string;
  authorHandle: string;
  authorPds: string;
  title: string;
  body: string;
  createdAt: string;
  boardSlug: string;
  attachments?: AttachmentView[];
}

const MAX_REF_PAGES = 20;
const REF_PAGE_SIZE = 100;

export interface ReplyRefsResult {
  items: BacklinkRef[];
  truncated: boolean;
  nextCursor: string | null;
}

/** Every reply ref for the thread, oldest-first. */
export async function fetchThreadRefs(
  threadUri: string,
  options: RequestOptions = {},
): Promise<ReplyRefsResult> {
  const collected: BacklinkRef[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  let truncated = false;
  for (let i = 0; i < MAX_REF_PAGES; i++) {
    const page = await getBacklinks(threadUri, `${POST}:root`, {
      limit: REF_PAGE_SIZE,
      cursor,
      ...options,
    });
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
  options: PublicReadOptions = {},
): Promise<Thread> {
  const { moderation, viewerDid, ...requestOptions } = options;
  const threadRecord = await getRecord(did, POST, tid, requestOptions);
  if (!isPostRecord(threadRecord)) {
    throw new Error("Invalid post record");
  }
  const postValue = threadRecord.value;
  const scope = parseAtUri(postValue.scope);
  if (
    threadRecord.value.root ||
    scope.did !== bbsDid ||
    scope.collection !== "xyz.atbbs.board"
  ) {
    throw new Error("Thread does not belong to this BBS");
  }
  if (
    moderation &&
    !getPostModeration(
      moderation,
      { uri: threadRecord.uri, did },
      viewerDid,
      bbsDid,
    ).isVisible
  ) {
    throw new Error("Thread is not available");
  }
  const author = await resolveIdentity(did, requestOptions);
  await getRecord(bbsDid, "xyz.atbbs.board", scope.rkey, requestOptions);
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
    attachments: prepareAttachmentViews(
      postValue.attachments,
      did,
      author.pds ?? "",
    ),
  };
}

export interface ReplyPage {
  replies: Reply[];
  /** Lookup by URI for any reply referenced as a parent — includes both
   *  on-page replies and off-page parents fetched separately. */
  parentReplies: Record<string, Reply>;
}

function isVisibleReply(
  record: PostRecord,
  moderation: PublicReadOptions["moderation"],
  viewerDid: string | undefined,
) {
  if (!moderation) return true;
  const did = parseAtUri(record.uri).did;
  const communityDid = parseAtUri(record.value.scope).did;
  return getPostModeration(
    moderation,
    { uri: record.uri, did },
    viewerDid,
    communityDid,
  ).isVisible;
}

export async function hydrateReplyPage(
  threadUri: string,
  pageRefs: BacklinkRef[],
  options: PublicReadOptions = {},
): Promise<ReplyPage> {
  if (!pageRefs.length) return { replies: [], parentReplies: {} };
  const { moderation, viewerDid, ...requestOptions } = options;

  const records = (await getRecordsBatch(pageRefs, requestOptions))
    .filter(isPostRecord)
    .filter((record) => record.value.root === threadUri)
    .filter((record) => isVisibleReply(record, moderation, viewerDid));
  const authors = await resolveIdentitiesBatch(
    records.map((r) => parseAtUri(r.uri).did),
    requestOptions,
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
    const parentRecords = (await getRecordsBatch(parentRefs, requestOptions))
      .filter(isPostRecord)
      .filter((record) => record.value.root === threadUri)
      .filter((record) => isVisibleReply(record, moderation, viewerDid));
    const parentAuthors = await resolveIdentitiesBatch(
      parentRecords.map((r) => parseAtUri(r.uri).did),
      requestOptions,
    );
    for (const record of parentRecords) {
      const reply = recordToReply(record, parentAuthors);
      if (reply) parentReplies[reply.uri] = reply;
    }
  }

  return { replies, parentReplies };
}
