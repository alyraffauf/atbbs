/** Debounced BBS resolution — resolves a handle to a BBS name if one exists. */

import { getAvatar, resolveIdentity } from "../lib/protocol/identities";
import { getRecord } from "../lib/protocol/records";
import { SITE } from "../lib/lexicon";
import { bbsUrl } from "../lib/routes";
import type { Suggestion } from "../lib/suggestions";
import { useDebouncedAsync } from "./useDebouncedAsync";

const DEBOUNCE_MS = 300;

export function useResolvedBBS(query: string): Suggestion | null {
  const input = query.trim();
  return useDebouncedAsync({
    input,
    enabled: !!input && input.includes("."),
    delay: DEBOUNCE_MS,
    loader: resolveBBSPreview,
    emptyValue: null,
  });
}

async function resolveBBSPreview(handle: string): Promise<Suggestion> {
  const identity = await resolveIdentity(handle);
  const [siteRecord, avatar] = await Promise.all([
    getRecord(identity.did, SITE, "self"),
    getAvatar(identity.did),
  ]);
  const siteValue = siteRecord.value as { name?: string };
  return {
    to: bbsUrl(identity.handle),
    name: siteValue.name ?? identity.handle,
    handle: identity.handle,
    avatar: avatar ?? undefined,
  };
}
