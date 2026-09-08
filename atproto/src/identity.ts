import { fetchJson, malformed } from "./transport";
import { DEFAULT_SLINGSHOT_URL } from "./services";

export interface ResolvedIdentity {
  did: string;
  handle: string;
  pds?: string;
}

export async function resolveIdentity(
  identifier: string,
  serviceUrl = DEFAULT_SLINGSHOT_URL,
): Promise<ResolvedIdentity> {
  const identity = await fetchJson<ResolvedIdentity>(
    `${serviceUrl}/blue.microcosm.identity.resolveMiniDoc?identifier=${encodeURIComponent(identifier)}`,
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
