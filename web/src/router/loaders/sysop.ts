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
import { mainSchema as banSchema } from "../../lexicons/types/xyz/atboards/ban";
import { mainSchema as hideSchema } from "../../lexicons/types/xyz/atboards/hide";
import type { XyzAtboardsBan, XyzAtboardsHide } from "../../lexicons";
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

async function hydrateHiddenPosts(uris: Set<string>): Promise<HiddenInfo[]> {
  if (uris.size === 0) return [];

  const uriList = [...uris];
  const dids = [...new Set(uriList.map((uri) => parseAtUri(uri).did))];

  const [identities, records] = await Promise.all([
    resolveIdentitiesBatch(dids),
    Promise.allSettled(uriList.map(getRecordByUri)),
  ]);

  return uriList.map((uri, index) => {
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

  const banRkeys = buildRkeyMap<XyzAtboardsBan.Main>(
    banRecs,
    banSchema,
    (ban) => ban.did,
  );
  const hideRkeys = buildRkeyMap<XyzAtboardsHide.Main>(
    hideRecs,
    hideSchema,
    (hide) => hide.uri,
  );

  let bannedHandles: Record<string, string> = {};
  if (bbs.site.bannedDids.size) {
    try {
      const authors = await resolveIdentitiesBatch([...bbs.site.bannedDids]);
      for (const did of bbs.site.bannedDids)
        bannedHandles[did] = authors[did]?.handle ?? did;
    } catch {
      for (const did of bbs.site.bannedDids) bannedHandles[did] = did;
    }
  }

  const hidden = await hydrateHiddenPosts(bbs.site.hiddenPosts);

  return { user, bbs, banRkeys, bannedHandles, hideRkeys, hidden };
}
