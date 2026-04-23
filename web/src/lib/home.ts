/** Minimal check for the dashboard: does this user run a BBS, and if so
 *  what's it called? A full BBS fetch only happens on the BBS page itself. */

import { getRecord } from "./atproto";
import { SITE } from "./lexicon";

export interface HomeSysopInfo {
  hasBBS: boolean;
  bbsName: string | null;
}

export async function fetchHomeSysopInfo(did: string): Promise<HomeSysopInfo> {
  try {
    const record = await getRecord(did, SITE, "self");
    const value = record.value as { name?: string };
    return { hasBBS: true, bbsName: value.name ?? null };
  } catch {
    return { hasBBS: false, bbsName: null };
  }
}
