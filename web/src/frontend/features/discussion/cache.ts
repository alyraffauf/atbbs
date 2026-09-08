import { queryClient } from "../../app/queryClient";
import {
  threadPageQuery,
  threadRefsQuery,
  type DiscussionReadContext,
} from "./queries";
import {
  REPLIES_PER_PAGE,
  type Reply,
  type ReplyPage,
  type ReplyRef,
  type ReplyRefsResult,
} from "@atbbs/core/discussion";
import { refToUri } from "./pagination";

export async function cancelRefsRefetch(
  threadUri: string,
  readContext: DiscussionReadContext,
) {
  await queryClient.cancelQueries({
    queryKey: threadRefsQuery(threadUri, readContext.audience).queryKey,
  });
}

export function getRefs(
  threadUri: string,
  readContext: DiscussionReadContext,
): ReplyRef[] {
  const key = threadRefsQuery(threadUri, readContext.audience).queryKey;
  return queryClient.getQueryData<ReplyRefsResult>(key)?.items ?? [];
}

export function setRefs(
  threadUri: string,
  refs: ReplyRef[],
  readContext: DiscussionReadContext,
) {
  queryClient.setQueryData<ReplyRefsResult>(
    threadRefsQuery(threadUri, readContext.audience).queryKey,
    (current) => ({
      items: refs,
      truncated: current?.truncated ?? false,
      nextCursor: current?.nextCursor ?? null,
    }),
  );
}

function pageSlice(refs: ReplyRef[], page: number): ReplyRef[] {
  const start = (page - 1) * REPLIES_PER_PAGE;
  return refs.slice(start, start + REPLIES_PER_PAGE);
}

// threadPageQuery's key is fingerprinted by rkeys, so the key changes on
// add/delete — seed the new key from the old one rather than using `prev`.
export function appendRefAndReply(
  threadUri: string,
  newRef: ReplyRef,
  newReply: Reply,
  readContext: DiscussionReadContext,
): ReplyRef[] {
  const previousRefs = getRefs(threadUri, readContext);
  const updatedRefs = [...previousRefs, newRef].slice(-2_000);

  const newLastPage = Math.max(
    1,
    Math.ceil(updatedRefs.length / REPLIES_PER_PAGE),
  );
  const oldPageRefs = pageSlice(previousRefs, newLastPage);
  const oldKey = threadPageQuery(
    threadUri,
    newLastPage,
    oldPageRefs,
    readContext,
  ).queryKey;
  const oldData = queryClient.getQueryData<ReplyPage>(oldKey);

  setRefs(threadUri, updatedRefs, readContext);

  const pageRefs = pageSlice(updatedRefs, newLastPage);
  const newKey = threadPageQuery(
    threadUri,
    newLastPage,
    pageRefs,
    readContext,
  ).queryKey;
  queryClient.setQueryData<ReplyPage>(newKey, {
    replies: [...(oldData?.replies ?? []), newReply],
    parentReplies: oldData?.parentReplies ?? {},
  });

  return updatedRefs;
}

export function removeRefAndReply(
  threadUri: string,
  replyUri: string,
  readContext: DiscussionReadContext,
) {
  const previousRefs = getRefs(threadUri, readContext);
  const updatedRefs = previousRefs.filter((ref) => refToUri(ref) !== replyUri);
  setRefs(threadUri, updatedRefs, readContext);
  queryClient.removeQueries({
    queryKey: ["thread-page", threadUri],
  });
  void queryClient.invalidateQueries({ queryKey: ["thread-page", threadUri] });
}
