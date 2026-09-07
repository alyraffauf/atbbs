/** Debounced handle typeahead using Bluesky's public API. */

import { searchHandles, type HandleMatch } from "../lib/bsky";
import { useDebouncedAsync } from "./useDebouncedAsync";

const DEBOUNCE_MS = 300;
const EMPTY_MATCHES: HandleMatch[] = [];

export function useHandleSearch(query: string): HandleMatch[] {
  const input = query.trim();
  return useDebouncedAsync({
    input,
    enabled: input.length >= 2,
    delay: DEBOUNCE_MS,
    loader: searchHandles,
    emptyValue: EMPTY_MATCHES,
  });
}
