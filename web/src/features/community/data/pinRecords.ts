import type { XyzAtbbsPin } from "../../../lexicons";
import { PIN } from "../../../shared/config/lexicon";
import { nowIso } from "../../../shared/config/util";
import { createRecord, type AuthenticatedRepo } from "../../../shared/protocol/repository";

type PinValue = Omit<XyzAtbbsPin.Main, "$type">;

export function createPin(repo: AuthenticatedRepo, did: string) {
  const value: PinValue = {
    did: did as PinValue["did"],
    createdAt: nowIso(),
  };
  return createRecord(repo, PIN, value, did);
}
