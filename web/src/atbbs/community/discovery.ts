/** Fetch a random list of BBSes from the Lightrail API, with avatars. */

import { getAvatars, resolveIdentitiesBatch } from "../identity/service";
import { SERVICES, SITE } from "../../config";
import { isSiteRecord, type SiteRecord } from "../schema/records";
import { fetchJson, malformed } from "../../atproto/transport";
import { getRecordsByUri } from "../support/records";
import { makeAtUri, parseAtUri } from "../../atproto/uri";
import type { Did } from "@atcute/lexicons/syntax";

export interface DiscoveredBBS {
  did: string;
  handle: string;
  name: string;
  description: string;
  avatar?: string;
}

interface LightrailRepo {
  did: string;
}

export async function fetchDiscovery(): Promise<DiscoveredBBS[]> {
  const data = await fetchJson<{ repos: LightrailRepo[] }>(
    `${SERVICES.lightrail}/com.atproto.sync.listReposByCollection?collection=${SITE}&limit=50`,
  );
  if (
    !data ||
    !Array.isArray(data.repos) ||
    data.repos.some(
      (repo) =>
        !repo || typeof repo.did !== "string" || !repo.did.startsWith("did:"),
    )
  ) {
    malformed("Discovery service");
  }
  const repos = data.repos;
  if (!repos.length) return [];

  const dids = [...new Set(repos.map((repo) => repo.did))];
  const [identities, siteRecords] = await Promise.all([
    resolveIdentitiesBatch(dids),
    getRecordsByUri(
      dids.map((did) => makeAtUri(did as Did, SITE, "self")),
      { failureMode: "best-effort" },
    ),
  ]);

  const sites = new Map<string, SiteRecord>();
  for (const siteRecord of siteRecords) {
    if (!isSiteRecord(siteRecord)) malformed("Discovered site record");
    sites.set(parseAtUri(siteRecord.uri).did, siteRecord);
  }

  const items: DiscoveredBBS[] = [];
  for (const repoDid of dids) {
    const identity = identities[repoDid];
    const siteRecord = sites.get(repoDid);
    if (!identity || !siteRecord) continue;
    items.push({
      did: repoDid,
      handle: identity.handle,
      name: siteRecord.value.name || identity.handle,
      description: siteRecord.value.description,
    });
  }

  const avatars = await getAvatars(items.map((item) => item.did));
  for (const item of items) {
    item.avatar = avatars[item.did];
  }

  return items;
}
