export class FetchError extends Error {
  constructor(
    public readonly kind:
      "not-found" | "rate-limit" | "server" | "transport" | "malformed",
    message: string,
  ) {
    super(message);
  }
}

export function isNotFound(error: unknown): error is FetchError {
  return error instanceof FetchError && error.kind === "not-found";
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
