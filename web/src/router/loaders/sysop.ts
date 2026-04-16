import { redirect } from "react-router-dom";
import { resolveBBS, type BBS } from "../../lib/bbs";
import {
  getRecordByUri,
  listRecords,
  resolveIdentitiesBatch,
} from "../../lib/atproto";
import { BAN, HIDE } from "../../lib/lexicon";
import { parseAtUri } from "../../lib/util";
import { is } from "@atcute/lexicons/validations";
import { mainSchema as banSchema } from "../../lexicons/types/xyz/atbbs/ban";
import { mainSchema as hideSchema } from "../../lexicons/types/xyz/atbbs/hide";
import type { XyzAtbbsBan, XyzAtbbsHide } from "../../lexicons";
import { requireAuth } from "./auth";

export interface HiddenInfo {
  uri: string;
  handle: string;
  title: string;
  body: string;
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

export async function sysopEditLoader() {
  const user = await requireAuth();
  try {
    const bbs = await resolveBBS(user.handle);
    return { user, bbs };
  } catch {
    throw redirect("/account/create");
  }
}

export async function sysopModerateLoader() {
  const user = await requireAuth();

  let bbs: BBS;
  try {
    bbs = await resolveBBS(user.handle);
  } catch {
    throw redirect("/account/create");
  }

  const [banRecs, hideRecs] = await Promise.all([
    listRecords(user.pdsUrl, user.did, BAN),
    listRecords(user.pdsUrl, user.did, HIDE),
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

  const hiddenUris = Object.keys(hideRkeys);
  const hidden = await hydrateHiddenPosts(hiddenUris);

  return { user, bbs, banRkeys, bannedHandles, hideRkeys, hidden };
}
