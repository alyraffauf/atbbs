import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { hydrateThreadPage } from "../../../atbbs/discussion/threads";
import {
  fetchThreadRefs,
  fetchThreadRoot,
  hydrateReplyPage,
} from "../../../atbbs/discussion/thread";
import { fetchNews } from "../../../atbbs/discussion/news";
import type { ReplyRef } from "../../../atbbs/discussion/replies";

export const boardThreadsInfiniteQuery = (bbsDid: string, slug: string) =>
  infiniteQueryOptions({
    queryKey: ["board-threads", bbsDid, slug] as const,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      hydrateThreadPage(bbsDid, slug, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor ?? undefined,
    refetchOnMount: "always",
  });

export const newsQuery = (bbsDid: string) =>
  queryOptions({
    queryKey: ["news", bbsDid] as const,
    queryFn: () => fetchNews(bbsDid),
  });

export const threadRefsQuery = (threadUri: string) =>
  queryOptions({
    queryKey: ["thread-refs", threadUri] as const,
    queryFn: () => fetchThreadRefs(threadUri),
  });

export const threadRootQuery = (bbsDid: string, did: string, tid: string) =>
  queryOptions({
    queryKey: ["thread-root", bbsDid, did, tid] as const,
    queryFn: () => fetchThreadRoot(bbsDid, did, tid),
  });

export const threadPageQuery = (
  threadUri: string,
  page: number,
  pageRefs: ReplyRef[],
) =>
  queryOptions({
    queryKey: [
      "thread-page",
      threadUri,
      page,
      pageRefs.map((ref) => ref.rkey).join("/"),
    ] as const,
    queryFn: () => hydrateReplyPage(threadUri, pageRefs),
  });
