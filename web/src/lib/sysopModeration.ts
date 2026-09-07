/** Load a sysop's bans + hides, hydrated with identities and post previews. */

import { resolveIdentitiesBatch } from "../shared/protocol/identities";
import { getRecordsByUri } from "../shared/protocol/records";
import { parseAtUri } from "../shared/protocol/uri";
import { fetchBBSModeration } from "./bbsModeration";

export interface HiddenInfo {
  uri: string;
  handle: string;
  title: string;
  body: string;
}

export interface SysopModeration {
  banRkeys: Record<string, string[]>;
  bannedHandles: Record<string, string>;
  hideRkeys: Record<string, string[]>;
  hidden: HiddenInfo[];
}

async function hydrateHiddenPosts(uris: string[]): Promise<HiddenInfo[]> {
  if (uris.length === 0) return [];

  const dids = [...new Set(uris.map((uri) => parseAtUri(uri).did))];

  const [identities, records] = await Promise.all([
    resolveIdentitiesBatch(dids),
    getRecordsByUri(uris, { failureMode: "best-effort" }),
  ]);

  const recordsByUri = new Map(records.map((record) => [record.uri, record]));
  return uris.map((uri) => {
    const did = parseAtUri(uri).did;
    const handle = identities[did]?.handle ?? did;
    const record = recordsByUri.get(uri);
    if (record) {
      const value = record.value as unknown as {
        title?: string;
        body?: string;
      };
      return {
        uri,
        handle,
        title: value.title ?? "",
        body: (value.body ?? "").substring(0, 100),
      };
    }
    return { uri, handle, title: "", body: uri };
  });
}

export async function fetchSysopModeration(
  pdsUrl: string,
  did: string,
): Promise<SysopModeration> {
  const { banRkeys, hideRkeys } = await fetchBBSModeration(pdsUrl, did);

  const bannedDids = Object.keys(banRkeys);
  let bannedHandles: Record<string, string> = {};
  if (bannedDids.length) {
    try {
      const authors = await resolveIdentitiesBatch(bannedDids);
      for (const did of bannedDids)
        bannedHandles[did] = authors[did]?.handle ?? did;
    } catch {
      for (const did of bannedDids) bannedHandles[did] = did;
    }
  }

  const hidden = await hydrateHiddenPosts(Object.keys(hideRkeys));

  return { banRkeys, bannedHandles, hideRkeys, hidden };
}
