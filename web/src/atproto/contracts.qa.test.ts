import { afterEach, describe, expect, it, vi } from "vitest";

import { createRecord, type AuthenticatedRepo } from "./repository";
import { fetchJson, type FetchError } from "./transport";

afterEach(() => vi.unstubAllGlobals());

describe("protocol errors", () => {
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
