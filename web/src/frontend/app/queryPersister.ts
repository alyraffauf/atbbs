import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { version } from "../../../package.json";

export const CACHE_SCHEMA_VERSION = 3;
const BUSTER = `${version}:${CACHE_SCHEMA_VERSION}`;
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
    shouldDehydrateQuery: (query: Parameters<typeof defaultShouldDehydrateQuery>[0]) =>
      defaultShouldDehydrateQuery(query) && query.queryKey[0] !== "thread-page",
  },
};
