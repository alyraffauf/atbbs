/** Load a sysop's bans + hides, hydrated with identities and post previews. */

import { getRecordByUri, listRecords, resolveIdentitiesBatch } from "./atproto";
import { BAN, HIDE } from "./lexicon";
import { parseAtUri } from "./util";
import { is } from "@atcute/lexicons/validations";
import { mainSchema as banSchema } from "../lexicons/types/xyz/atbbs/ban";
import { mainSchema as hideSchema } from "../lexicons/types/xyz/atbbs/hide";
import type { XyzAtbbsBan, XyzAtbbsHide } from "../lexicons";

export interface HiddenInfo {
  uri: string;
  handle: string;
  title: string;
  body: string;
}

export interface SysopModeration {
  banRkeys: Record<string, string>;
  bannedHandles: Record<string, string>;
  hideRkeys: Record<string, string>;
  hidden: HiddenInfo[];
}

function buildRkeyMap<T>(
  records: { uri: string; value: Record<string, unknown> }[],
  schema: Parameters<typeof is>[0],
  getKey: (value: T) => string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const record of records) {
    if (!is(schema, record.value)) continue;
    map[getKey(record.value as unknown as T)] = parseAtUri(record.uri).rkey;
  }
  return map;
}

async function hydrateHiddenPosts(uris: string[]): Promise<HiddenInfo[]> {
  if (uris.length === 0) return [];

  const dids = [...new Set(uris.map((uri) => parseAtUri(uri).did))];

  const [identities, records] = await Promise.all([
    resolveIdentitiesBatch(dids),
    Promise.allSettled(uris.map(getRecordByUri)),
  ]);

  return uris.map((uri, index) => {
    const did = parseAtUri(uri).did;
    const handle = identities[did]?.handle ?? did;
    const result = records[index];
    if (result.status === "fulfilled") {
      const value = result.value.value as unknown as {
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
  const [banRecs, hideRecs] = await Promise.all([
    listRecords(pdsUrl, did, BAN),
    listRecords(pdsUrl, did, HIDE),
  ]);

  const banRkeys = buildRkeyMap<XyzAtbbsBan.Main>(
    banRecs,
    banSchema,
    (ban) => ban.did,
  );
  const hideRkeys = buildRkeyMap<XyzAtbbsHide.Main>(
    hideRecs,
    hideSchema,
    (hide) => hide.uri,
  );

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
