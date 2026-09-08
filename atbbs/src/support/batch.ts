import { isNotFound } from "@atbbs/atproto";

export async function allSettledBounded<T, Result>(
  values: T[],
  worker: (value: T) => Promise<Result>,
  concurrency = 10,
): Promise<PromiseSettledResult<Result>[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
    throw new RangeError("Concurrency must be a positive safe integer");
  }
  const results: PromiseSettledResult<Result>[] = [];
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
    .filter((reason) => !isNotFound(reason));
  if (failures.length) {
    console.warn(
      `${operation} completed with ${failures.length} partial failure(s)`,
      failures,
    );
  }
}
