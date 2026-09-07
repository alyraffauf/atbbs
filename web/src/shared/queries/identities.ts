import { queryOptions } from "@tanstack/react-query";
import { resolveIdentity } from "../../atproto/identity";
import { getBacklinkCount } from "../../atproto/backlinks";
import { getAvatar } from "../../atbbs/identity/service";
import { slowQueryOptions } from "./options";

export const identityQuery = (identifier: string) =>
  queryOptions({
    ...slowQueryOptions,
    queryKey: ["identity", identifier] as const,
    queryFn: () => resolveIdentity(identifier),
  });

export const avatarQuery = (did: string) =>
  queryOptions({
    ...slowQueryOptions,
    queryKey: ["avatar", did] as const,
    queryFn: () => getAvatar(did),
  });

export const backlinkCountQuery = (subject: string, source: string) =>
  queryOptions({
    queryKey: ["backlink-count", source, subject] as const,
    queryFn: () => getBacklinkCount(subject, source),
  });
