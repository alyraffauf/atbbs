import type { XyzAtbbsProfile } from "../../../lexicons";
import { PROFILE } from "../../../shared/config/lexicon";
import { nowIso } from "../../../shared/config/util";
import { putRecord, type AuthenticatedRepo } from "../../../shared/protocol/repository";

type ProfileValue = Omit<XyzAtbbsProfile.Main, "$type">;

export function putProfile(
  repo: AuthenticatedRepo,
  name?: string,
  pronouns?: string,
  bio?: string,
) {
  const value: ProfileValue = {
    ...(name ? { name } : {}),
    ...(pronouns ? { pronouns } : {}),
    ...(bio ? { bio } : {}),
    createdAt: nowIso() as ProfileValue["createdAt"],
  };
  return putRecord(repo, PROFILE, "self", value);
}
