import { SERVICES } from "./config";
import { fetchJson, malformed } from "./transport";

const SLINGSHOT = SERVICES.slingshot;

export interface ResolvedIdentity {
  did: string;
  handle: string;
  pds?: string;
}

export async function resolveIdentity(
  identifier: string,
): Promise<ResolvedIdentity> {
  const identity = await fetchJson<ResolvedIdentity>(
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
