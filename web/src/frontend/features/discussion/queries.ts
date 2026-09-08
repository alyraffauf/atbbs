import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
  fetchNews,
  fetchThreadRefs,
  fetchThreadRoot,
  hydrateReplyPage,
  hydrateThreadPage,
  type ReplyRef,
} from "@atbbs/core/discussion";
import type { ModerationState } from "@atbbs/core/moderation";

export interface DiscussionReadContext {
  moderation: ModerationState;
  audience: "public" | "sysop";
  viewerDid?: string;
}

export const boardThreadsInfiniteQuery = (
  bbsDid: string,
  slug: string,
  readContext: DiscussionReadContext,
) =>
  infiniteQueryOptions({
    queryKey: ["board-threads", bbsDid, slug, readContext.audience] as const,
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | undefined;
      signal: AbortSignal;
    }) =>
      hydrateThreadPage(bbsDid, slug, {
        cursor: pageParam,
        moderation: readContext.moderation,
        viewerDid: readContext.viewerDid,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor ?? undefined,
    refetchOnMount: "always",
  });

export const newsQuery = (bbsDid: string) =>
  queryOptions({
    queryKey: ["news", bbsDid] as const,
    queryFn: () => fetchNews(bbsDid),
  });

export const threadRefsQuery = (
  threadUri: string,
  audience: DiscussionReadContext["audience"],
) =>
  queryOptions({
    queryKey: ["thread-refs", threadUri, audience] as const,
    queryFn: ({ signal }) => fetchThreadRefs(threadUri, { signal }),
  });

export const threadRootQuery = (
  bbsDid: string,
  did: string,
  tid: string,
  readContext: DiscussionReadContext,
) =>
  queryOptions({
    queryKey: ["thread-root", bbsDid, did, tid, readContext.audience] as const,
    queryFn: ({ signal }) =>
      fetchThreadRoot(bbsDid, did, tid, {
        moderation: readContext.moderation,
        viewerDid: readContext.viewerDid,
        signal,
      }),
  });

export const threadPageQuery = (
  threadUri: string,
  page: number,
  pageRefs: ReplyRef[],
  readContext: DiscussionReadContext,
) =>
  queryOptions({
    queryKey: [
      "thread-page",
      threadUri,
      page,
      pageRefs.map((ref) => ref.rkey).join("/"),
      readContext.audience,
    ] as const,
    queryFn: ({ signal }) =>
      hydrateReplyPage(threadUri, pageRefs, {
        moderation: readContext.moderation,
        viewerDid: readContext.viewerDid,
        signal,
      }),
  });
