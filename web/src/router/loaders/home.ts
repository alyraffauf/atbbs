import { getRecord } from "../../lib/atproto";
import { ensureAuthReady, getCurrentUser } from "../../lib/auth";
import { fetchActivity } from "../../lib/activity";
import { fetchPins } from "../../lib/pins";
import { fetchMyThreads } from "../../lib/mythreads";
import { SITE } from "../../lib/lexicon";

export async function homeLoader() {
  await ensureAuthReady();
  const user = getCurrentUser();
  if (!user) return { user: null };

  let hasBBS = false;
  let bbsName: string | null = null;
  try {
    const record = await getRecord(user.did, SITE, "self");
    hasBBS = true;
    const value = record.value as { name?: string };
    bbsName = value.name ?? null;
  } catch {
    // no site record
  }

  return {
    user,
    hasBBS,
    bbsName,
    activity: fetchActivity(user.did, user.pdsUrl),
    pins: fetchPins(user.pdsUrl, user.did),
    threads: fetchMyThreads(user.pdsUrl, user.did),
  };
}
