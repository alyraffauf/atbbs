import { FetchError } from "../../atproto/transport";

export async function allSettledBounded<T, Result>(
  values: T[],
  worker: (value: T) => Promise<Result>,
  concurrency = 10,
): Promise<PromiseSettledResult<Result>[]> {
  const results: PromiseSettledResult<Result>[] = new Array(values.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(values[index]),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, run),
  );
  return results;
}

export function reportPartialFailures(
  operation: string,
  results: PromiseSettledResult<unknown>[],
) {
  const failures = results
    .filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    .map((result) => result.reason)
    .filter(
      (reason) =>
        !(reason instanceof FetchError && reason.kind === "not-found"),
    );
  if (failures.length) {
    console.warn(
      `${operation} completed with ${failures.length} partial failure(s)`,
      failures,
    );
  }
}
