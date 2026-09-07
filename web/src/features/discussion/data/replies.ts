/** Pure helpers for reply pagination and hydration. */

import type { BacklinkRef } from "../../../atproto/backlinks";
import type { ATRecord } from "../../../atproto/records";
import { makeAtUri, parseAtUri } from "../../../atproto/uri";
import type { Did, Nsid } from "@atcute/lexicons/syntax";
import { isPostRecord } from "../../../shared/protocol/recordGuards";
export interface Reply {
  uri: string;
  did: string;
  rkey: string;
  handle: string;
  pds: string;
  body: string;
  createdAt: string;
  parent: string | null;
  attachments: { file: { ref: { $link: string } }; name: string }[];
}

export type { BacklinkRef };

export const REPLIES_PER_PAGE = 10;

export function parsePageParam(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function refToUri(ref: BacklinkRef): string {
  return makeAtUri(ref.did as Did, ref.collection as Nsid, ref.rkey);
}

export function pageForReply(
  refs: BacklinkRef[],
  replyUri: string | null,
): number | null {
  if (!replyUri) return null;
  const index = refs.findIndex((ref) => refToUri(ref) === replyUri);
  return index >= 0 ? Math.floor(index / REPLIES_PER_PAGE) + 1 : null;
}

export function rkeyFromHash(): string | null {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  return hash.startsWith("#reply-") ? hash.slice(7) : null;
}

export function pageForRkey(
  refs: BacklinkRef[],
  rkey: string | null,
): number | null {
  if (!rkey) return null;
  const index = refs.findIndex((ref) => ref.rkey === rkey);
  return index >= 0 ? Math.floor(index / REPLIES_PER_PAGE) + 1 : null;
}

export function clampPage(page: number, totalRefs: number): number {
  const totalPages = Math.max(1, Math.ceil(totalRefs / REPLIES_PER_PAGE));
  return Math.max(1, Math.min(page, totalPages));
}

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
    attachments: (record.value.attachments ?? []) as Reply["attachments"],
  };
}
