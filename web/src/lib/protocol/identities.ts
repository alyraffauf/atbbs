import { CDN, SERVICES } from "../shared";
import { getRecord } from "./records";
import {
  allSettledBounded,
  FetchError,
  fetchJson,
  malformed,
  reportPartialFailures,
} from "./transport";

const SLINGSHOT = SERVICES.slingshot;
const BSKY_PROFILE = "app.bsky.actor.profile";

export interface MiniDoc {
  did: string;
  handle: string;
  pds?: string;
}

export async function resolveIdentity(identifier: string): Promise<MiniDoc> {
  const identity = await fetchJson<MiniDoc>(
    `${SLINGSHOT}/blue.microcosm.identity.resolveMiniDoc?identifier=${encodeURIComponent(identifier)}`,
  );
  if (
    !identity ||
    typeof identity.did !== "string" ||
    typeof identity.handle !== "string" ||
    (identity.pds !== undefined && typeof identity.pds !== "string")
  ) {
    malformed("Identity service");
  }
  return identity;
}

export async function resolveIdentitiesBatch(ids: string[]) {
  const results = await allSettledBounded([...new Set(ids)], resolveIdentity);
  reportPartialFailures("Identity hydration", results);
  const identities: Record<string, MiniDoc> = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      identities[result.value.did] = result.value;
    }
  }
  return identities;
}

export async function getAvatar(did: string): Promise<string | null> {
  try {
    const record = await getRecord(did, BSKY_PROFILE, "self");
    const avatar = record.value.avatar as
      { ref?: { $link?: string } } | undefined;
    const cid = avatar?.ref?.$link;
    return cid ? `${CDN.url}/img/avatar/plain/${did}/${cid}` : null;
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
