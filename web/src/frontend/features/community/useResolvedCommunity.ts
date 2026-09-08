/** Debounced BBS resolution — resolves a handle to a BBS name if one exists. */

import { resolveCommunityPreview } from "@atbbs/core/community";
import { bbsUrl } from "../../app/router/urls";
import type { Suggestion } from "./data/suggestions";
import { useDebouncedAsync } from "../../ui/useDebouncedAsync";

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
  const preview = await resolveCommunityPreview(handle);
  return {
    to: bbsUrl(preview.handle),
    ...preview,
  };
}
