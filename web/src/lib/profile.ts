/** Fetch a user's atbbs profile and BBS info. */

import { getRecord, resolveIdentity } from "./atproto";
import { PROFILE, SITE } from "./lexicon";
import { is } from "@atcute/lexicons/validations";
import { mainSchema as profileSchema } from "../lexicons/types/xyz/atbbs/profile";
import { mainSchema as siteSchema } from "../lexicons/types/xyz/atbbs/site";
import type { XyzAtbbsProfile, XyzAtbbsSite } from "../lexicons";

export interface Profile {
  did: string;
  handle: string;
  pdsUrl: string;
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
  } catch {
    return null;
  }

  const [profileResult, siteResult] = await Promise.allSettled([
    getRecord(identity.did, PROFILE, "self"),
    getRecord(identity.did, SITE, "self"),
  ]);

  const profile: Profile = {
    did: identity.did,
    handle: identity.handle,
    pdsUrl: identity.pds ?? "",
  };

  if (
    profileResult.status === "fulfilled" &&
    is(profileSchema, profileResult.value.value)
  ) {
    const value = profileResult.value.value as unknown as XyzAtbbsProfile.Main;
    profile.name = value.name;
    profile.pronouns = value.pronouns;
    profile.bio = value.bio;
    profile.createdAt = value.createdAt;
  }

  if (
    siteResult.status === "fulfilled" &&
    is(siteSchema, siteResult.value.value)
  ) {
    const value = siteResult.value.value as unknown as XyzAtbbsSite.Main;
    profile.bbsName = value.name;
    profile.bbsDescription = value.description;
  }

  return profile;
}
