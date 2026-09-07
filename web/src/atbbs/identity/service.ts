import { resolveIdentity, type ResolvedIdentity } from "../../atproto/identity";
import { getRecord } from "../../atproto/records";
import { FetchError } from "../../atproto/transport";
import { allSettledBounded, reportPartialFailures } from "../support/batch";
import { avatarUrl } from "../media/urls";

export { resolveIdentity };

const BSKY_PROFILE = "app.bsky.actor.profile";

export async function resolveIdentitiesBatch(ids: string[]) {
  const results = await allSettledBounded([...new Set(ids)], resolveIdentity);
  reportPartialFailures("Identity hydration", results);
  const identities: Record<string, ResolvedIdentity> = {};
  for (const result of results) {
    if (result.status === "fulfilled") identities[result.value.did] = result.value;
  }
  return identities;
}

export async function getAvatar(did: string): Promise<string | null> {
  try {
    const record = await getRecord(did, BSKY_PROFILE, "self");
    const avatar = record.value.avatar as { ref?: { $link?: string } } | undefined;
    const cid = avatar?.ref?.$link;
    return cid ? avatarUrl(did, cid) : null;
  } catch (error) {
    if (error instanceof FetchError && error.kind === "not-found") return null;
    throw error;
  }
}

export async function getAvatars(dids: string[]) {
  const unique = [...new Set(dids)];
  const results = await allSettledBounded(unique, getAvatar);
  reportPartialFailures("Avatar hydration", results);
  const avatars: Record<string, string> = {};
  unique.forEach((did, index) => {
    const result = results[index];
    const url = result.status === "fulfilled" ? result.value : null;
    if (url) avatars[did] = url;
  });
  return avatars;
}
