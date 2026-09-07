import { afterEach, describe, expect, it, vi } from "vitest";

import { boardLoader } from "./app/router/loaders/content";
import { queryClient } from "./app/queryClient";
import {
  bbsQuery,
  discoveryQuery,
  homeSysopQuery,
  pinCountsQuery,
  pinsQuery,
} from "./features/community/data/community";
import {
  boardThreadsInfiniteQuery,
  newsQuery,
  threadPageQuery,
  threadRefsQuery,
  threadRootQuery,
} from "./features/discussion/data/discussionQueries";
import { createRecord, type AuthenticatedRepo } from "./shared/protocol/repository";
import {
  allSettledBounded,
  fetchJson,
  type FetchError,
} from "./shared/protocol/transport";

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

describe("protocol errors and ordering", () => {
  it.each([
    [404, "not-found"],
    [429, "rate-limit"],
    [503, "server"],
  ] as const)("classifies HTTP %i as %s", async (status, kind) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("failure", { status })));
    await expect(fetchJson("https://service.example/xrpc")).rejects.toMatchObject<
      Partial<FetchError>
    >({ kind });
  });

  it("preserves input order when bounded work finishes out of order", async () => {
    const pending = new Map<number, () => void>();
    const resultsPromise = allSettledBounded(
      [1, 2, 3],
      (value) =>
        new Promise<number>((resolve) => pending.set(value, () => resolve(value))),
      3,
    );
    await vi.waitFor(() => expect(pending.size).toBe(3));
    pending.get(3)!();
    pending.get(1)!();
    pending.get(2)!();
    expect(await resultsPromise).toEqual([
      { status: "fulfilled", value: 1 },
      { status: "fulfilled", value: 2 },
      { status: "fulfilled", value: 3 },
    ]);
  });
});

describe("record writes", () => {
  it("keeps the create-record envelope and explicit rkey", async () => {
    const post = vi.fn(async () => ({
      ok: true,
      data: { uri: "at://did:plc:me/xyz.atbbs.pin/fixed", cid: "cid" },
    }));
    const repo = {
      did: "did:plc:me",
      client: { post },
    } as unknown as AuthenticatedRepo;

    await createRecord(repo, "xyz.atbbs.pin", { did: "did:plc:bbs" }, "fixed");

    expect(post).toHaveBeenCalledWith("com.atproto.repo.createRecord", {
      input: {
        repo: "did:plc:me",
        collection: "xyz.atbbs.pin",
        rkey: "fixed",
        record: { $type: "xyz.atbbs.pin", did: "did:plc:bbs" },
      },
    });
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
