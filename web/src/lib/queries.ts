/** Query-key factories. Every useQuery/useMutation in the app goes through
 *  one of these so query keys live in one place. */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
  fetchIdentityDoc,
  fetchAvatarUrl,
  fetchBacklinkCount,
} from "./atproto";
import { STALE_SLOW } from "./queryClient";
import { resolveBBS } from "./bbs";
import { fetchNews } from "./news";
import { fetchProfile } from "./profile";
import { fetchMyThreads } from "./mythreads";
import { fetchActivity } from "./activity";
import { fetchPins } from "./pins";
import { fetchDiscovery } from "./discovery";
import { fetchHomeSysopInfo } from "./home";
import { fetchSysopModeration } from "./sysopModeration";
import { fetchBBSModeration } from "./bbsModeration";
import { hydrateThreadPage } from "./boardThreads";
import { fetchThreadRefs, fetchThreadRoot, hydrateReplyPage } from "./thread";
import type { BacklinkRef } from "./atproto";

// Shared by slow-changing queries: 5-minute staleTime, and skip the
// "refetch on every mount" default that live queries use.
const slowQueryOpts = { staleTime: STALE_SLOW, refetchOnMount: true } as const;

export const bbsQuery = (handle: string) =>
  queryOptions({
    ...slowQueryOpts,
    queryKey: ["bbs", handle] as const,
    queryFn: () => resolveBBS(handle),
  });

export const newsQuery = (bbsDid: string) =>
  queryOptions({
    queryKey: ["news", bbsDid] as const,
    queryFn: () => fetchNews(bbsDid),
  });

export const identityQuery = (identifier: string) =>
  queryOptions({
    ...slowQueryOpts,
    queryKey: ["identity", identifier] as const,
    queryFn: () => fetchIdentityDoc(identifier),
  });

export const avatarQuery = (did: string) =>
  queryOptions({
    ...slowQueryOpts,
    queryKey: ["avatar", did] as const,
    queryFn: () => fetchAvatarUrl(did),
  });

export const backlinkCountQuery = (subject: string, source: string) =>
  queryOptions({
    queryKey: ["backlink-count", source, subject] as const,
    queryFn: () => fetchBacklinkCount(subject, source),
  });

export const profileQuery = (handle: string) =>
  queryOptions({
    ...slowQueryOpts,
    queryKey: ["profile", handle] as const,
    queryFn: () => fetchProfile(handle),
  });

export const myThreadsQuery = (pdsUrl: string, did: string) =>
  queryOptions({
    queryKey: ["my-threads", did] as const,
    queryFn: () => fetchMyThreads(pdsUrl, did),
  });

export const activityQuery = (pdsUrl: string, did: string) =>
  queryOptions({
    queryKey: ["activity", did] as const,
    queryFn: () => fetchActivity(did, pdsUrl),
  });

export const pinsQuery = (pdsUrl: string, did: string) =>
  queryOptions({
    queryKey: ["pins", did] as const,
    queryFn: () => fetchPins(pdsUrl, did),
  });

export const discoveryQuery = () =>
  queryOptions({
    queryKey: ["discovery"] as const,
    queryFn: fetchDiscovery,
  });

export const homeSysopQuery = (did: string) =>
  queryOptions({
    queryKey: ["home-sysop", did] as const,
    queryFn: () => fetchHomeSysopInfo(did),
  });

export const sysopModerationQuery = (pdsUrl: string, did: string) =>
  queryOptions({
    queryKey: ["sysop-moderation", did] as const,
    queryFn: () => fetchSysopModeration(pdsUrl, did),
  });

export const bbsModerationQuery = (pdsUrl: string, did: string) =>
  queryOptions({
    queryKey: ["bbs-moderation", did] as const,
    queryFn: () => fetchBBSModeration(pdsUrl, did),
  });

export const boardThreadsInfiniteQuery = (bbsDid: string, slug: string) =>
  infiniteQueryOptions({
    queryKey: ["board-threads", bbsDid, slug] as const,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      hydrateThreadPage(bbsDid, slug, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor ?? undefined,
    refetchOnMount: "always",
  });

export const threadRefsQuery = (threadUri: string) =>
  queryOptions({
    queryKey: ["thread-refs", threadUri] as const,
    queryFn: () => fetchThreadRefs(threadUri),
  });

export const threadRootQuery = (did: string, tid: string) =>
  queryOptions({
    queryKey: ["thread-root", did, tid] as const,
    queryFn: () => fetchThreadRoot(did, tid),
  });

export const threadPageQuery = (
  threadUri: string,
  page: number,
  pageRefs: BacklinkRef[],
) =>
  queryOptions({
    // Fingerprint is part of the key so that when the thread-refs cache
    // gets updated (new replies, deletes), this page's cache entry gets
    // a new key and refetches — rather than serving a stale hydration.
    queryKey: [
      "thread-page",
      threadUri,
      page,
      pageRefs.map((ref) => ref.rkey).join("/"),
    ] as const,
    queryFn: () => hydrateReplyPage(pageRefs),
  });
