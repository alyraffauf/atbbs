import { queryOptions } from "@tanstack/react-query";
import { fetchBBSModeration } from "../../../atbbs/moderation/state";
import { fetchSysopModeration } from "../../../atbbs/moderation/sysop";

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
