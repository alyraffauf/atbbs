import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

// Bump on breaking cache-shape changes to invalidate older clients.
const BUSTER = "atbbs-v2";
const MAX_AGE = 24 * 60 * 60 * 1000;

const persister = createSyncStoragePersister({
  storage: localStorage,
  key: "atbbs:query-cache",
});

export const persistOptions = {
  persister,
  buster: BUSTER,
  maxAge: MAX_AGE,
  dehydrateOptions: {
    // thread-page keys are fingerprinted by reply rkeys, so persisting them
    // would accumulate stale entries. thread-refs drives page rebuild on load.
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[] }) =>
      query.queryKey[0] !== "thread-page",
  },
};
