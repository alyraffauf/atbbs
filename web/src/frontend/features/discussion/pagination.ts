import {
  REPLIES_PER_PAGE,
  type ReplyRef,
} from "../../../atbbs/discussion/replies";

export function parsePageParam(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function refToUri(ref: ReplyRef): string {
  return `at://${ref.did}/${ref.collection}/${ref.rkey}`;
}

export function pageForReply(
  refs: ReplyRef[],
  replyUri: string | null,
): number | null {
  if (!replyUri) return null;
  const index = refs.findIndex((ref) => refToUri(ref) === replyUri);
  return index >= 0 ? Math.floor(index / REPLIES_PER_PAGE) + 1 : null;
}

export function rkeyFromHash(): string | null {
  const hash = window.location.hash;
  return hash.startsWith("#reply-") ? hash.slice(7) : null;
}

export function pageForRkey(
  refs: ReplyRef[],
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
