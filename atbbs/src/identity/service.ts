import {
  getRecord,
  isNotFound,
  resolveIdentity,
  type RequestOptions,
  type ResolvedIdentity,
} from "@atbbs/atproto";
import { allSettledBounded, reportPartialFailures } from "../support/batch";
import { avatarUrl } from "../media/urls";

export { resolveIdentity };

const BSKY_PROFILE = "app.bsky.actor.profile";

export async function resolveIdentitiesBatch(
  ids: string[],
  options: RequestOptions = {},
) {
  const results = await allSettledBounded([...new Set(ids)], (id) =>
    resolveIdentity(id, options),
  );
  reportPartialFailures("Identity hydration", results);
  const identities: Record<string, ResolvedIdentity> = {};
  for (const result of results) {
    if (result.status === "fulfilled")
      identities[result.value.did] = result.value;
  }
  return identities;
}

export async function getAvatar(
  did: string,
  options: RequestOptions = {},
): Promise<string | null> {
  try {
    const record = await getRecord(did, BSKY_PROFILE, "self", options);
    const avatar = record.value.avatar as
      { ref?: { $link?: string } } | undefined;
    const cid = avatar?.ref?.$link;
    return cid ? avatarUrl(did, cid) : null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function getAvatars(dids: string[], options: RequestOptions = {}) {
  const unique = [...new Set(dids)];
  const results = await allSettledBounded(unique, (did) =>
    getAvatar(did, options),
  );
  reportPartialFailures("Avatar hydration", results);
  const avatars: Record<string, string> = {};
  unique.forEach((did, index) => {
    const result = results[index];
    const url = result.status === "fulfilled" ? result.value : null;
    if (url) avatars[did] = url;
  });
  return avatars;
}
