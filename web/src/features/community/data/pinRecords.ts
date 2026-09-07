import type { XyzAtbbsPin } from "../../../lexicons";
import { PIN } from "../../../atbbs/schema/collections";
import { nowIso } from "../../../atbbs/support/time";
import { createRecord, type AuthenticatedRepo } from "../../../atproto/repository";

type PinValue = Omit<XyzAtbbsPin.Main, "$type">;

export function createPin(repo: AuthenticatedRepo, did: string) {
  const value: PinValue = {
    did: did as PinValue["did"],
    createdAt: nowIso(),
  };
  return createRecord(repo, PIN, value, did);
}
