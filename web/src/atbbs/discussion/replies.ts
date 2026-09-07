/** Pure helpers for reply pagination and hydration. */

import type { ATRecord } from "../../atproto/records";
import { parseAtUri } from "../../atproto/uri";
import { isPostRecord } from "../schema/records";
import {
  prepareAttachmentViews,
  type AttachmentView,
} from "./attachments";
export interface Reply {
  uri: string;
  did: string;
  rkey: string;
  authorDid: string;
  replyRkey: string;
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
    authorDid: did,
    replyRkey: rkey,
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
