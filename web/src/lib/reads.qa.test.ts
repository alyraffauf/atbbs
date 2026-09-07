import { afterEach, describe, expect, it, vi } from "vitest";

import { getBacklinks } from "./protocol/backlinks";
import { getRecordsByUri, listRecords } from "./protocol/records";
import { FetchError } from "./protocol/transport";
import { fetchThreadRefs, fetchThreadRoot } from "./thread";

afterEach(() => vi.unstubAllGlobals());

describe("bounded network reads", () => {
  it("accepts Constellation's null terminal cursor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ total: 0, records: [], cursor: null })),
      ),
    );
    await expect(getBacklinks("at://board", "post:scope")).resolves.toEqual({
      total: 0,
      records: [],
      cursor: null,
    });
  });

  it("treats AT Protocol's missing-repository 400 as absence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: "InvalidRequest",
              message:
                "Upstream bad request: Could not find repo: did:plc:test",
            }),
            { status: 400 },
          ),
      ),
    );
    await expect(
      listRecords("https://pds.example", "did:plc:test", "example.collection"),
    ).rejects.toMatchObject<Partial<FetchError>>({ kind: "not-found" });
  });

  it("detects a repeated PDS cursor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ records: [], cursor: "same" }), {
            status: 200,
          }),
      ),
    );
    const result = await listRecords(
      "https://pds.example",
      "did:plc:test",
      "example.collection",
    );
    expect(result).toEqual({ items: [], truncated: true, nextCursor: "same" });
  });

  it("classifies malformed PDS listings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ records: "invalid" }))),
    );
    await expect(
      listRecords("https://pds.example", "did:plc:test", "example.collection"),
    ).rejects.toMatchObject<Partial<FetchError>>({ kind: "malformed" });
  });

  it("returns only the latest 2,000 reply references", async () => {
    const fetchMock = vi.fn(async () => {
      const page = fetchMock.mock.calls.length;
      return new Response(
        JSON.stringify({
          total: 2_001,
          records: Array.from({ length: 100 }, (_, index) => ({
            did: "did:plc:author",
            collection: "xyz.atbbs.post",
            rkey: `${page}-${index}`,
          })),
          cursor: `cursor-${page}`,
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchThreadRefs(
      "at://did:plc:author/xyz.atbbs.post/root",
    );
    expect(result.items).toHaveLength(2_000);
    expect(result.truncated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(20);
  });
});

describe("record ownership", () => {
  it("rejects a thread scoped to another BBS", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("getRecord")) {
          return new Response(
            JSON.stringify({
              uri: "at://did:plc:author/xyz.atbbs.post/thread",
              cid: "cid",
              value: {
                $type: "xyz.atbbs.post",
                scope: "at://did:plc:foreign/xyz.atbbs.board/general",
                title: "Foreign",
                body: "body",
                createdAt: "2026-01-01T00:00:00Z",
              },
            }),
          );
        }
        return new Response(
          JSON.stringify({ did: "did:plc:author", handle: "author.example" }),
        );
      }),
    );
    await expect(
      fetchThreadRoot("did:plc:bbs", "did:plc:author", "thread"),
    ).rejects.toThrow("does not belong");
  });
});

describe("record hydration failure policy", () => {
  const firstUri = "at://did:plc:alice/app.bsky.feed.post/first";
  const secondUri = "at://did:plc:bob/app.bsky.feed.post/second";

  it("rejects non-missing failures in strict mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("server error", { status: 500 })),
    );
    await expect(getRecordsByUri([firstUri])).rejects.toMatchObject({
      kind: "server",
    });
  });

  it("omits and reports non-missing failures in best-effort mode", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limited", { status: 429 })),
    );
    await expect(
      getRecordsByUri([firstUri], { failureMode: "best-effort" }),
    ).resolves.toEqual([]);
    expect(warning).toHaveBeenCalledWith(
      "Record hydration completed with 1 partial failure(s)",
      expect.any(Array),
    );
    warning.mockRestore();
  });

  it("omits missing records without reporting them", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );
    await expect(getRecordsByUri([firstUri])).resolves.toEqual([]);
    expect(warning).not.toHaveBeenCalled();
    warning.mockRestore();
  });

  it("deduplicates requests and preserves first-seen order", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const did = url.searchParams.get("repo")!;
      const rkey = url.searchParams.get("rkey")!;
      return new Response(
        JSON.stringify({
          uri: `at://${did}/app.bsky.feed.post/${rkey}`,
          cid: `cid-${rkey}`,
          value: {},
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const records = await getRecordsByUri([secondUri, firstUri, secondUri]);
    expect(records.map((record) => record.uri)).toEqual([secondUri, firstUri]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
