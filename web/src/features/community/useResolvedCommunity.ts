/** Debounced BBS resolution — resolves a handle to a BBS name if one exists. */

import { getAvatar, resolveIdentity } from "../../shared/protocol/identities";
import { getRecord } from "../../shared/protocol/records";
import { SITE } from "../../shared/config/lexicon";
import { bbsUrl } from "../../shared/config/routes";
import type { Suggestion } from "./data/suggestions";
import { useDebouncedAsync } from "../../shared/hooks/useDebouncedAsync";

const DEBOUNCE_MS = 300;

export function useResolvedCommunity(query: string): Suggestion | null {
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
