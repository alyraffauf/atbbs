/** Debounced handle typeahead using Bluesky's public API. */

import { useEffect, useState } from "react";
import { searchHandles, type HandleMatch } from "../lib/bsky";

const DEBOUNCE_MS = 300;

export function useHandleSearch(query: string): HandleMatch[] {
  const [matches, setMatches] = useState<HandleMatch[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setMatches([]);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      const results = await searchHandles(trimmed);
      if (!cancelled) setMatches(results);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return matches;
}
