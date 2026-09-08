import { getRecord, malformed, resolveIdentity } from "@atbbs/atproto";
import { getAvatar } from "../identity/service";
import { SITE } from "../config";
import { isSiteRecord } from "../schema/records";

export interface CommunityPreview {
  handle: string;
  name: string;
  avatar?: string;
}

export async function resolveCommunityPreview(
  handle: string,
): Promise<CommunityPreview> {
  const identity = await resolveIdentity(handle);
  const [siteRecord, avatar] = await Promise.all([
    getRecord(identity.did, SITE, "self"),
    getAvatar(identity.did),
  ]);
  if (!isSiteRecord(siteRecord)) malformed("Site record");
  return {
    handle: identity.handle,
    name: siteRecord.value.name || identity.handle,
    avatar: avatar ?? undefined,
  };
}
