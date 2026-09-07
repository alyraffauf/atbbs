import { queryOptions } from "@tanstack/react-query";
import { PIN } from "../../../shared/config/lexicon";
import { resolveBBS } from "./bbs";
import { fetchPins } from "./pins";
import { fetchDiscovery } from "./discovery";
import { fetchHomeSysopInfo } from "./home";
import { getBacklinkCountsBatch } from "../../../shared/protocol/backlinks";
import { slowQueryOptions } from "../../../shared/queries/options";

export const bbsQuery = (handle: string) =>
  queryOptions({
    ...slowQueryOptions,
    queryKey: ["bbs", handle] as const,
    queryFn: () => resolveBBS(handle),
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
