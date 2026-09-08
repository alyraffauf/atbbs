import {
  getRecord,
  getRecordByUri,
  isNotFound,
  type ATRecord,
  type BacklinkRef,
} from "@atbbs/atproto";
import { allSettledBounded, reportPartialFailures } from "./batch";

export interface RecordHydrationOptions {
  failureMode?: "strict" | "best-effort";
}

function collectRecords(
  results: PromiseSettledResult<ATRecord>[],
  failureMode: "strict" | "best-effort",
) {
  const failures = results.filter(
    (result): result is PromiseRejectedResult =>
      result.status === "rejected" && !isNotFound(result.reason),
  );
  if (failureMode === "strict" && failures.length) throw failures[0].reason;
  if (failureMode === "best-effort") {
    reportPartialFailures("Record hydration", results);
  }
  return results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

export async function getRecordsByUri(
  uris: string[],
  { failureMode = "strict" }: RecordHydrationOptions = {},
) {
  const results = await allSettledBounded([...new Set(uris)], getRecordByUri);
  return collectRecords(results, failureMode);
}

export async function getRecordsBatch(
  refs: BacklinkRef[],
  { failureMode = "strict" }: RecordHydrationOptions = {},
) {
  const unique = [
    ...new Map(
      refs.map((ref) => [`${ref.did}/${ref.collection}/${ref.rkey}`, ref]),
    ).values(),
  ];
  const results = await allSettledBounded(unique, (ref) =>
    getRecord(ref.did, ref.collection, ref.rkey),
  );
  return collectRecords(results, failureMode);
}
