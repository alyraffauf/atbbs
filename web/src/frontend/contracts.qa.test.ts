import { afterEach, describe, expect, it, vi } from "vitest";

import { boardLoader } from "./app/router/loaders/content";
import { queryClient } from "./app/queryClient";
import {
  bbsQuery,
  discoveryQuery,
  homeSysopQuery,
  pinCountsQuery,
  pinsQuery,
} from "./features/community/queries";
import {
  boardThreadsInfiniteQuery,
  newsQuery,
  threadPageQuery,
  threadRefsQuery,
  threadRootQuery,
} from "./features/discussion/queries";

afterEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("frontend query keys", () => {
  it("keeps every public query key stable", () => {
    expect(bbsQuery("bbs.example").queryKey).toEqual(["bbs", "bbs.example"]);
    expect(pinsQuery("https://pds.example", "did:plc:me").queryKey).toEqual([
      "pins",
      "did:plc:me",
    ]);
    expect(discoveryQuery().queryKey).toEqual(["discovery"]);
    expect(pinCountsQuery(["did:plc:z", "did:plc:a"]).queryKey).toEqual([
      "pin-counts",
      ["did:plc:a", "did:plc:z"],
    ]);
    expect(homeSysopQuery("did:plc:home").queryKey).toEqual([
      "home-sysop",
      "did:plc:home",
    ]);
    expect(boardThreadsInfiniteQuery("did:plc:bbs", "general").queryKey).toEqual(
      ["board-threads", "did:plc:bbs", "general"],
    );
    expect(newsQuery("did:plc:bbs").queryKey).toEqual([
      "news",
      "did:plc:bbs",
    ]);
    expect(threadRefsQuery("at://thread").queryKey).toEqual([
      "thread-refs",
      "at://thread",
    ]);
    expect(threadRootQuery("did:plc:bbs", "did:plc:author", "tid").queryKey).toEqual(
      ["thread-root", "did:plc:bbs", "did:plc:author", "tid"],
    );
    expect(
      threadPageQuery("at://thread", 2, [
        { did: "did:plc:a", collection: "xyz.atbbs.post", rkey: "one" },
        { did: "did:plc:b", collection: "xyz.atbbs.post", rkey: "two" },
      ]).queryKey,
    ).toEqual(["thread-page", "at://thread", 2, "one/two"]);
  });
});

describe("loader errors", () => {
  it("returns a 404 response when a board slug is missing", async () => {
    queryClient.setQueryData(["bbs", "bbs.example"], {
      identity: { did: "did:plc:bbs", handle: "bbs.example", pds: "https://pds.example" },
      site: {
        name: "BBS",
        description: "Description",
        intro: "Intro",
        boards: [],
        createdAt: "2026-01-01T00:00:00Z",
      },
    });
    const error = await boardLoader({
      params: { handle: "bbs.example", slug: "missing" },
      request: new Request("https://atbbs.example/bbs/bbs.example/missing"),
      context: undefined,
    } as unknown as Parameters<typeof boardLoader>[0]).catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).status).toBe(404);
    expect(await (error as Response).text()).toBe("Board not found");
  });
});
