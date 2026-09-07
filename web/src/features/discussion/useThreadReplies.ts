/** Thread-page data fetcher: refs from Constellation, hydrated page replies,
 *  plus pagination + scroll-to-reply helpers. Optimistic mutations are in
 *  Thread.tsx and update the same query caches via setQueryData. */

import { useSearchParams } from "react-router-dom";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  threadPageQuery,
  threadRefsQuery,
} from "../../frontend/features/discussion/queries";
import { parseAtUri } from "../../atproto/uri";
import {
  REPLIES_PER_PAGE,
  clampPage,
  parsePageParam,
  pageForRkey,
  pageForReply,
  rkeyFromHash,
} from "../../atbbs/discussion/replies";

export function useThreadReplies(threadUri: string) {
  const [params, setParams] = useSearchParams();

  const { data: refsResult } = useSuspenseQuery(threadRefsQuery(threadUri));
  const refs = refsResult.items;
  const totalPages = Math.max(1, Math.ceil(refs.length / REPLIES_PER_PAGE));

  // --- Page derived from URL, clamped to the available range ---

  const requestedPage = parsePageParam(params.get("page"));
  const replyParam = params.get("reply");
  const hashRkey = rkeyFromHash();
  const initialPage =
    pageForRkey(refs, hashRkey) ??
    pageForReply(refs, replyParam) ??
    requestedPage;
  const page = clampPage(initialPage, refs.length);

  const pageStart = (page - 1) * REPLIES_PER_PAGE;
  const pageRefs = refs.slice(pageStart, pageStart + REPLIES_PER_PAGE);

  const { data: pageData } = useSuspenseQuery(
    threadPageQuery(threadUri, page, pageRefs),
  );
  const { replies, parentReplies } = pageData;

  // --- Navigation helpers ---

  function setPage(next: number) {
    const clamped = clampPage(next, refs.length);
    setParams((prev) => writePageParam(prev, clamped));
  }

  function scrollToReply(uri: string) {
    const { rkey } = parseAtUri(uri);
    const onScreen = document.getElementById(`reply-${rkey}`);
    if (onScreen) {
      onScreen.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const targetPage = pageForRkey(refs, rkey);
    if (targetPage === null) return;
    setParams((prev) => {
      const next = writePageParam(prev, targetPage);
      next.set("reply", uri);
      return next;
    });
  }

  return {
    page,
    setPage,
    totalPages,
    refs,
    replies,
    parentReplies,
    truncated: refsResult.truncated,
    scrollToReply,
  };
}

function writePageParam(prev: URLSearchParams, page: number) {
  const next = new URLSearchParams(prev);
  if (page === 1) next.delete("page");
  else next.set("page", String(page));
  next.delete("reply");
  return next;
}
