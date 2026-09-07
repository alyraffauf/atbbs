import { queryClient } from "../../../app/queryClient";
import { threadPageQuery, threadRefsQuery } from "./discussionQueries";
import { REPLIES_PER_PAGE, refToUri } from "./replies";
import type { BacklinkRef } from "../../../atproto/backlinks";
import type { ReplyPage } from "./thread";
import type { Reply } from "./replies";
import type { BoundedResult } from "../../../atproto/records";

export async function cancelRefsRefetch(threadUri: string) {
  await queryClient.cancelQueries({
    queryKey: threadRefsQuery(threadUri).queryKey,
  });
}

export function getRefs(threadUri: string): BacklinkRef[] {
  const key = threadRefsQuery(threadUri).queryKey;
  return queryClient.getQueryData<BoundedResult<BacklinkRef>>(key)?.items ?? [];
}

export function setRefs(threadUri: string, refs: BacklinkRef[]) {
  queryClient.setQueryData<BoundedResult<BacklinkRef>>(
    threadRefsQuery(threadUri).queryKey,
    (current) => ({
      items: refs,
      truncated: current?.truncated ?? false,
      nextCursor: current?.nextCursor ?? null,
    }),
  );
}

function pageSlice(refs: BacklinkRef[], page: number): BacklinkRef[] {
  const start = (page - 1) * REPLIES_PER_PAGE;
  return refs.slice(start, start + REPLIES_PER_PAGE);
}

// threadPageQuery's key is fingerprinted by rkeys, so the key changes on
// add/delete — seed the new key from the old one rather than using `prev`.
export function appendRefAndReply(
  threadUri: string,
  newRef: BacklinkRef,
  newReply: Reply,
): BacklinkRef[] {
  const previousRefs = getRefs(threadUri);
  const updatedRefs = [...previousRefs, newRef].slice(-2_000);

  const newLastPage = Math.max(
    1,
    Math.ceil(updatedRefs.length / REPLIES_PER_PAGE),
  );
  const oldPageRefs = pageSlice(previousRefs, newLastPage);
  const oldKey = threadPageQuery(threadUri, newLastPage, oldPageRefs).queryKey;
  const oldData = queryClient.getQueryData<ReplyPage>(oldKey);

  setRefs(threadUri, updatedRefs);

  const pageRefs = pageSlice(updatedRefs, newLastPage);
  const newKey = threadPageQuery(threadUri, newLastPage, pageRefs).queryKey;
  queryClient.setQueryData<ReplyPage>(newKey, {
    replies: [...(oldData?.replies ?? []), newReply],
    parentReplies: oldData?.parentReplies ?? {},
  });

  return updatedRefs;
}

export function removeRefAndReply(threadUri: string, replyUri: string) {
  const previousRefs = getRefs(threadUri);
  const updatedRefs = previousRefs.filter((ref) => refToUri(ref) !== replyUri);
  setRefs(threadUri, updatedRefs);
  queryClient.removeQueries({
    queryKey: ["thread-page", threadUri],
  });
  void queryClient.invalidateQueries({ queryKey: ["thread-page", threadUri] });
}
