import { QueryClient } from "@tanstack/react-query";

/** Stays fresh for 30s: posts, replies, activity, counts. */
export const STALE_LIVE = 30 * 1000;

/** Stays fresh for 5 min: identities, avatars, site records, profiles. */
export const STALE_SLOW = 5 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_LIVE,
      // Every page navigation refetches live data. Slow queries opt out
      // via `refetchOnMount: true` in queries.ts.
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});
