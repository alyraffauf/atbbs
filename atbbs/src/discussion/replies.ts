import {
  makeAtUri,
  parseAtUri,
  type ATRecord,
  type AuthenticatedRepo,
} from "@atbbs/atproto";
import { isPostRecord } from "../schema/records";
import { prepareAttachmentViews, type AttachmentView } from "./attachments";
import type { PendingAttachment } from "./attachments";
import { BOARD } from "../config";
import type { Did } from "@atcute/lexicons/syntax";
import { createPost } from "./posts";

export interface CreateReplyInput {
  communityDid: string;
  boardSlug: string;
  threadUri: string;
  parent?: string;
  body: string;
  attachments: PendingAttachment[];
}

export function createReply(
  repo: AuthenticatedRepo,
  pdsUrl: string,
  input: CreateReplyInput,
) {
  return createPost(repo, pdsUrl, {
    scope: makeAtUri(input.communityDid as Did, BOARD, input.boardSlug),
    body: input.body,
    root: input.threadUri,
    parent: input.parent,
    attachments: input.attachments,
  });
}

export interface Reply {
  uri: string;
  did: string;
  rkey: string;
  handle: string;
  pds: string;
  body: string;
  createdAt: string;
  parent: string | null;
  parentRkey: string | null;
  attachments: AttachmentView[];
}

export interface ReplyRef {
  did: string;
  collection: string;
  rkey: string;
}

export const REPLIES_PER_PAGE = 10;

export function recordToReply(
  record: ATRecord,
  authors: Record<string, { handle: string; pds?: string }>,
): Reply | null {
  const { did, rkey } = parseAtUri(record.uri);
  if (!(did in authors)) return null;
  if (!isPostRecord(record)) return null;
  return {
    uri: record.uri,
    did,
    rkey,
    handle: authors[did].handle,
    pds: authors[did].pds ?? "",
    body: record.value.body,
    createdAt: record.value.createdAt,
    parent: record.value.parent ?? null,
    parentRkey: record.value.parent
      ? parseAtUri(record.value.parent).rkey
      : null,
    attachments: prepareAttachmentViews(
      record.value.attachments,
      did,
      authors[did].pds ?? "",
    ),
  };
}
