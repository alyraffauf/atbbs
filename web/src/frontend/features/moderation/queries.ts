import { queryOptions } from "@tanstack/react-query";
import { fetchBBSModeration } from "../../../features/moderation/data/bbsModeration";
import { fetchSysopModeration } from "../../../features/moderation/data/sysopModeration";

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
