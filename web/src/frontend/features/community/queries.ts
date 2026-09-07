import { queryOptions } from "@tanstack/react-query";
import { PIN } from "../../../atbbs/schema/collections";
import { resolveCommunity } from "../../../atbbs/community/read";
import { fetchPins } from "../../../atbbs/community/pins";
import { fetchDiscovery } from "../../../atbbs/community/discovery";
import { fetchHomeSysopInfo } from "../../../atbbs/community/home";
import { getBacklinkCountsBatch } from "../../../atbbs/discussion/hydration";
import { slowQueryOptions } from "../../app/queryOptions";
import { getAvatar } from "../../../atbbs/identity/service";

export const bbsQuery = (handle: string) =>
  queryOptions({
    ...slowQueryOptions,
    queryKey: ["bbs", handle] as const,
    queryFn: () => resolveCommunity(handle),
  });

export const pinsQuery = (pdsUrl: string, did: string) =>
  queryOptions({
    queryKey: ["pins", did] as const,
    queryFn: () => fetchPins(pdsUrl, did),
  });

export const discoveryQuery = () =>
  queryOptions({ queryKey: ["discovery"] as const, queryFn: fetchDiscovery });

export const pinCountsQuery = (dids: string[]) =>
  queryOptions({
    queryKey: ["pin-counts", [...dids].sort()] as const,
    queryFn: () => getBacklinkCountsBatch(dids, `${PIN}:did`),
    enabled: dids.length > 0,
  });

export const homeSysopQuery = (did: string) =>
  queryOptions({
    queryKey: ["home-sysop", did] as const,
    queryFn: () => fetchHomeSysopInfo(did),
  });

export const avatarQuery = (did: string) =>
  queryOptions({
    ...slowQueryOptions,
    queryKey: ["avatar", did] as const,
    queryFn: () => getAvatar(did),
  });
