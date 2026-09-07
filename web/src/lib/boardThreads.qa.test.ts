import { afterEach, describe, expect, it, vi } from "vitest";

import { hydrateThreadPage } from "./boardThreads";

afterEach(() => vi.unstubAllGlobals());

describe("board thread hydration", () => {
  it("keeps valid threads when a stale root returns a server error", async () => {
    const boardUri =
      "at://did:plc:sysop/xyz.atbbs.board/general";
    const staleRoot =
      "at://did:plc:missing/xyz.atbbs.post/stale-root";
    const goodRoot = "at://did:plc:author/xyz.atbbs.post/good-root";
    const replyUri = "at://did:plc:reader/xyz.atbbs.post/reply";
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("blue.microcosm.links.getBacklinks")) {
          return new Response(
            JSON.stringify({
              total: 2,
              records: [
                {
                  did: "did:plc:reader",
                  collection: "xyz.atbbs.post",
                  rkey: "reply",
                },
                {
                  did: "did:plc:author",
                  collection: "xyz.atbbs.post",
                  rkey: "good-root",
                },
              ],
              cursor: null,
            }),
          );
        }
        if (url.pathname.endsWith("blue.microcosm.links.getBacklinksCount")) {
          return new Response(JSON.stringify({ total: 0 }));
        }
        if (url.pathname.endsWith("blue.microcosm.identity.resolveMiniDoc")) {
          const did = url.searchParams.get("identifier");
          return new Response(
            JSON.stringify({ did, handle: `${did}.example`, pds: "https://pds.example" }),
          );
        }

        const collection = url.searchParams.get("collection");
        const rkey = url.searchParams.get("rkey");
        if (collection === "app.bsky.actor.profile") {
          return new Response("missing", { status: 404 });
        }
        if (rkey === "stale-root") {
          return new Response(
            JSON.stringify({ error: "ServerError", message: "sorry" }),
            { status: 500 },
          );
        }
        if (rkey === "reply") {
          return new Response(
            JSON.stringify({
              uri: replyUri,
              cid: "reply-cid",
              value: {
                $type: "xyz.atbbs.post",
                scope: boardUri,
                root: staleRoot,
                body: "Reply",
                createdAt: "2026-01-02T00:00:00Z",
              },
            }),
          );
        }
        return new Response(
          JSON.stringify({
            uri: goodRoot,
            cid: "root-cid",
            value: {
              $type: "xyz.atbbs.post",
              scope: boardUri,
              title: "Working thread",
              body: "Body",
              createdAt: "2026-01-01T00:00:00Z",
            },
          }),
        );
      }),
    );

    const result = await hydrateThreadPage("did:plc:sysop", "general");
    expect(result.threads.map((thread) => thread.uri)).toEqual([goodRoot]);
    expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });
});
