export class FetchError extends Error {
  constructor(
    public readonly kind:
      "not-found" | "rate-limit" | "server" | "transport" | "malformed",
    message: string,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new FetchError("transport", String(error));
  }
  if (response.status === 404) {
    throw new FetchError("not-found", `404 ${url}`);
  }
  if (response.status === 400) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { error?: unknown; message?: unknown } | null;
    const error = typeof body?.error === "string" ? body.error : "";
    const message = typeof body?.message === "string" ? body.message : "";
    if (
      error === "RecordNotFound" ||
      /could not find (?:repo|record)/i.test(message)
    ) {
      throw new FetchError("not-found", message || `400 ${url}`);
    }
  }
  if (response.status === 429) {
    throw new FetchError("rate-limit", `429 ${url}`);
  }
  if (response.status >= 500) {
    throw new FetchError("server", `${response.status} ${url}`);
  }
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new FetchError("malformed", String(error));
  }
}

export function malformed(label: string): never {
  throw new FetchError("malformed", `${label} returned malformed data`);
}

export async function allSettledBounded<T, R>(
  values: T[],
  worker: (value: T) => Promise<R>,
  concurrency = 10,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(values.length);
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
