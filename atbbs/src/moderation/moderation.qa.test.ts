import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchBBSModeration } from "./state";
import { fetchSysopModeration } from "./sysop";

const bannedDid = "did:plc:banned";
const hiddenUri = "at://did:plc:author/xyz.atbbs.post/hidden";

function record(uri: string, value: Record<string, unknown>) {
  return { uri, cid: `cid-${uri}`, value };
}

function installModerationFetchMock() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("com.atproto.repo.listRecords")) {
        const collection = url.searchParams.get("collection");
        const records =
          collection === "xyz.atbbs.ban"
            ? [
                record("at://did:plc:sysop/xyz.atbbs.ban/ban-one", {
                  $type: "xyz.atbbs.ban",
                  did: bannedDid,
                  createdAt: "2026-01-01T00:00:00Z",
                }),
                record("at://did:plc:sysop/xyz.atbbs.ban/ban-two", {
                  $type: "xyz.atbbs.ban",
                  did: bannedDid,
                  createdAt: "2026-01-02T00:00:00Z",
                }),
              ]
            : [
                record("at://did:plc:sysop/xyz.atbbs.hide/hide-one", {
                  $type: "xyz.atbbs.hide",
                  uri: hiddenUri,
                  createdAt: "2026-01-01T00:00:00Z",
                }),
                record("at://did:plc:sysop/xyz.atbbs.hide/hide-two", {
                  $type: "xyz.atbbs.hide",
                  uri: hiddenUri,
                  createdAt: "2026-01-02T00:00:00Z",
                }),
              ];
        return new Response(JSON.stringify({ records }));
      }
      if (url.pathname.endsWith("blue.microcosm.identity.resolveMiniDoc")) {
        const identifier = url.searchParams.get("identifier");
        return new Response(
          JSON.stringify({ did: identifier, handle: `${identifier}.example` }),
        );
      }
      return new Response(
        JSON.stringify(
          record(hiddenUri, {
            $type: "xyz.atbbs.post",
            scope: "at://did:plc:sysop/xyz.atbbs.board/general",
            title: "Hidden",
            body: "Body",
            createdAt: "2026-01-01T00:00:00Z",
          }),
        ),
      );
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe.each([
  ["BBS", fetchBBSModeration],
  ["sysop", fetchSysopModeration],
] as const)("%s moderation", (_view, loadModeration) => {
  it("preserves every rkey for duplicate targets", async () => {
    installModerationFetchMock();
    const result = await loadModeration("https://pds.example", "did:plc:sysop");
    expect(result.banRkeys[bannedDid]).toEqual(["ban-one", "ban-two"]);
    expect(result.hideRkeys[hiddenUri]).toEqual(["hide-one", "hide-two"]);
  });
});
