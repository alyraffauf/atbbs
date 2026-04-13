import { getRecord } from "../../lib/atproto";
import { fetchInbox } from "../../lib/inbox";
import { SITE } from "../../lib/lexicon";
import { requireAuth } from "./auth";

export type { InboxItem } from "../../lib/inbox";

export async function accountLoader() {
  const user = await requireAuth();

  let hasBBS = false;
  let bbsName: string | null = null;
  try {
    const siteRecord = await getRecord(user.did, SITE, "self");
    hasBBS = true;
    const siteValue = siteRecord.value as unknown as { name?: string };
    bbsName = siteValue.name ?? user.handle;
  } catch {
    // no site
  }

  const itemsPromise = fetchInbox(user.did, user.pdsUrl);
  return { user, hasBBS, bbsName, items: itemsPromise };
}

export async function requireAuthLoader() {
  return { user: await requireAuth() };
}
