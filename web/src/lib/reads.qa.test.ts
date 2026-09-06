import { afterEach, describe, expect, it, vi } from "vitest";

import { FetchError, getBacklinks, listRecords } from "./atproto";
import { fetchThreadRefs, fetchThreadRoot } from "./thread";

afterEach(() => vi.unstubAllGlobals());

describe("bounded network reads", () => {
  it("accepts Constellation's null terminal cursor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
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
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "InvalidRequest",
            message: "Upstream bad request: Could not find repo: did:plc:test",
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
      vi.fn(async () =>
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
