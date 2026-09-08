import { afterEach, describe, expect, it, vi } from "vitest";

import { FetchError, fetchJson } from "./transport";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("JSON transport", () => {
  it("forwards the caller signal without a deadline", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ value: true })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchJson("https://example.test/data", {
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.test/data", {
      signal: controller.signal,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("classifies caller cancellation as a transport failure", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: string | URL | Request, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        });
      }),
    );

    const result = fetchJson("https://example.test/data", {
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    controller.abort();

    await expect(result).rejects.toMatchObject<Partial<FetchError>>({
      kind: "transport",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts at the optional deadline and classifies it as transport", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: string | URL | Request, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        });
      }),
    );

    const result = fetchJson("https://example.test/data", { timeoutMs: 50 });
    const assertion = expect(result).rejects.toMatchObject<Partial<FetchError>>(
      {
        kind: "transport",
      },
    );
    await vi.advanceTimersByTimeAsync(50);

    await assertion;
  });

  it("cleans up a deadline timer after a completed request", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ value: true }))),
    );

    await fetchJson("https://example.test/data", { timeoutMs: 1_000 });

    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    [404, "not-found"],
    [429, "rate-limit"],
    [500, "server"],
  ] as const)("classifies HTTP %i responses as %s", async (status, kind) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("failure", { status })),
    );

    await expect(fetchJson("https://example.test/data")).rejects.toMatchObject<
      Partial<FetchError>
    >({ kind });
  });

  it("classifies AT Protocol's missing-record 400 as not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: "RecordNotFound", message: "missing" }),
            { status: 400 },
          ),
      ),
    );

    await expect(fetchJson("https://example.test/data")).rejects.toMatchObject<
      Partial<FetchError>
    >({ kind: "not-found" });
  });

  it("keeps unclassified client errors as ordinary HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("forbidden", { status: 403 })),
    );

    await expect(fetchJson("https://example.test/data")).rejects.toThrow(
      "403 https://example.test/data",
    );
  });
});
