/** Fetch a user's atbbs profile and BBS info. */

import {
  getRecord,
  isNotFound,
  malformed,
  putRecord,
  resolveIdentity,
  type AuthenticatedRepo,
} from "@atbbs/atproto";
import { getAvatar } from "../identity/service";
import { PROFILE, SITE } from "../config";
import { isProfileRecord, isSiteRecord } from "../schema/records";
import type { XyzAtbbsProfile } from "../lexicons";
import { nowIso } from "../support/time";

type ProfileValue = Omit<XyzAtbbsProfile.Main, "$type">;

export interface ProfileDraft {
  name?: string;
  pronouns?: string;
  bio?: string;
}

export interface Profile {
  did: string;
  handle: string;
  pdsUrl: string;
  avatar?: string;
  name?: string;
  pronouns?: string;
  bio?: string;
  bbsName?: string;
  bbsDescription?: string;
  createdAt?: string;
}

export async function fetchProfile(handle: string): Promise<Profile | null> {
  let identity;
  try {
    identity = await resolveIdentity(handle);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }

  const [[profileResult, siteResult], avatar] = await Promise.all([
    Promise.allSettled([
      getRecord(identity.did, PROFILE, "self"),
      getRecord(identity.did, SITE, "self"),
    ]),
    getAvatar(identity.did),
  ]);

  const profile: Profile = {
    did: identity.did,
    handle: identity.handle,
    pdsUrl: identity.pds ?? "",
    avatar: avatar ?? undefined,
  };

  for (const result of [profileResult, siteResult]) {
    if (result.status === "rejected" && !isNotFound(result.reason)) {
      throw result.reason;
    }
  }

  if (profileResult.status === "fulfilled") {
    if (!isProfileRecord(profileResult.value)) malformed("Profile record");
    const value = profileResult.value.value;
    profile.name = value.name;
    profile.pronouns = value.pronouns;
    profile.bio = value.bio;
    profile.createdAt = value.createdAt;
  }

  if (siteResult.status === "fulfilled") {
    if (!isSiteRecord(siteResult.value)) malformed("Site record");
    const value = siteResult.value.value;
    profile.bbsName = value.name;
    profile.bbsDescription = value.description;
  }

  return profile;
}

export async function saveProfile(
  repo: AuthenticatedRepo,
  draft: ProfileDraft,
): Promise<void> {
  const value: ProfileValue = {
    ...(draft.name ? { name: draft.name } : {}),
    ...(draft.pronouns ? { pronouns: draft.pronouns } : {}),
    ...(draft.bio ? { bio: draft.bio } : {}),
    createdAt: nowIso() as ProfileValue["createdAt"],
  };
  await putRecord(repo, PROFILE, "self", value);
}
