import { queryOptions } from "@tanstack/react-query";
import { fetchActivity } from "../../../features/dashboard/data/activity";
import { fetchMyThreads } from "../../../features/dashboard/data/mythreads";

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
