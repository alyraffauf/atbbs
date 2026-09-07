/** Minimal check for the dashboard: does this user run a BBS, and if so
 *  what's it called? A full BBS fetch only happens on the BBS page itself. */

import { getRecord } from "../../atproto/records";
import { SITE } from "../schema/collections";
import { isSiteRecord } from "../schema/records";
import { FetchError, malformed } from "../../atproto/transport";

export interface HomeSysopInfo {
  hasBBS: boolean;
  bbsName: string | null;
}

export async function fetchHomeSysopInfo(did: string): Promise<HomeSysopInfo> {
  try {
    const record = await getRecord(did, SITE, "self");
    if (!isSiteRecord(record)) malformed("Site record");
    return { hasBBS: true, bbsName: record.value.name };
  } catch (error) {
    if (!(error instanceof FetchError) || error.kind !== "not-found") {
      throw error;
    }
    return { hasBBS: false, bbsName: null };
  }
}
