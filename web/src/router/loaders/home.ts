import { getRecord } from "../../lib/atproto";
import { ensureAuthReady, getCurrentUser } from "../../lib/auth";
import { fetchInbox } from "../../lib/inbox";
import { fetchPins } from "../../lib/pins";
import { fetchMyThreads } from "../../lib/mythreads";
import { SITE } from "../../lib/lexicon";

export async function homeLoader() {
  await ensureAuthReady();
  const user = getCurrentUser();
  if (!user) return { user: null };

  let hasBBS = false;
  try {
    await getRecord(user.did, SITE, "self");
    hasBBS = true;
  } catch {
    // no site record
  }

  return {
    user,
    hasBBS,
    items: fetchInbox(user.did, user.pdsUrl),
    pins: fetchPins(user.pdsUrl, user.did),
    threads: fetchMyThreads(user.pdsUrl, user.did),
  };
}
