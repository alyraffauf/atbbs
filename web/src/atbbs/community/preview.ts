import { resolveIdentity } from "../../atproto/identity";
import { getRecord } from "../../atproto/records";
import { getAvatar } from "../identity/service";
import { SITE } from "../schema/collections";

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
  const siteValue = siteRecord.value as { name?: string };
  return {
    handle: identity.handle,
    name: siteValue.name ?? identity.handle,
    avatar: avatar ?? undefined,
  };
}
