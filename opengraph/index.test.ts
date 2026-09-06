import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("workers-og", () => ({
  ImageResponse: class extends Response {
    constructor() {
      super("image", { headers: { "content-type": "image/png" } });
    }
  },
  loadGoogleFont: async () => new ArrayBuffer(0),
}));

import worker, { fetchMetadata, injectMetadata, parseRoute } from "./index";

afterEach(() => vi.unstubAllGlobals());

describe("OpenGraph routing", () => {
  it("parses thread routes without query data", () => {
    expect(parseRoute("/bbs/bbs.example/thread/did:plc:user/key")).toEqual({
      type: "thread",
      handle: "bbs.example",
      did: "did:plc:user",
      rkey: "key",
    });
  });

  it("escapes injected metadata", () => {
    const html = injectMetadata(
      "<title>atbbs</title><meta property=\"og:type\"><meta property=\"og:title\" content=\"atbbs\" /><meta property=\"og:description\" content=\"Decentralized forums on the AT Protocol.\" /><meta property=\"og:image\" content=\"/og.png\" /></head>",
      "<unsafe>",
      "description",
      "https://atbbs.example/path",
      "https://atbbs.example/image.png",
      { canonical: "at://x", author: "did:plc:x", me: "did:plc:x" },
    );
    expect(html).toContain("&lt;unsafe&gt;");
    expect(html).not.toContain("<unsafe>");
  });

  it("normalizes image cache keys to method and path", async () => {
    const entries = new Map<string, Response>();
    vi.stubGlobal("caches", {
      default: {
        match: async (request: Request) => entries.get(request.url)?.clone(),
        put: async (request: Request, response: Response) => {
          entries.set(request.url, response.clone());
        },
      },
    });
    const pending: Promise<unknown>[] = [];
    const context = {
      waitUntil(promise: Promise<unknown>) {
        pending.push(promise);
      },
    } as ExecutionContext;

    await worker.fetch(
      new Request("https://atbbs.example/og/bbs/x/invalid.png?a=1"),
      {},
      context,
    );
    await Promise.all(pending);
    await worker.fetch(
      new Request("https://atbbs.example/og/bbs/x/invalid.png?a=2", {
        method: "HEAD",
      }),
      {},
      context,
    );
    expect(entries.size).toBe(1);
    expect([...entries.keys()][0]).toBe(
      "https://atbbs.example/og/bbs/x/invalid.png",
    );
  });

  it("rejects non-read methods", async () => {
    const response = await worker.fetch(
      new Request("https://atbbs.example/", { method: "POST" }),
      {},
      { waitUntil() {} } as unknown as ExecutionContext,
    );
    expect(response.status).toBe(405);
  });

  it("withholds metadata for a thread on a foreign BBS", async () => {
    const responses = [
      { did: "did:plc:bbs", handle: "bbs.example" },
      {
        uri: "at://did:plc:bbs/xyz.atbbs.site/self",
        cid: "site",
        value: { name: "BBS" },
      },
      {
        uri: "at://did:plc:author/xyz.atbbs.post/thread",
        cid: "post",
        value: {
          title: "Foreign",
          body: "body",
          scope: "at://did:plc:other/xyz.atbbs.board/general",
        },
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(responses.shift()))),
    );
    await expect(
      fetchMetadata({
        type: "thread",
        handle: "bbs.example",
        did: "did:plc:author",
        rkey: "thread",
      }),
    ).resolves.toBeNull();
  });
});
