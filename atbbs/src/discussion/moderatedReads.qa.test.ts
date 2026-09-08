import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModerationState } from "../moderation/state";
import { fetchNews } from "./news";
import { hydrateReplyPage } from "./thread";
import { hydrateThreadPage } from "./threads";

const communityDid = "did:plc:sysop";
const boardUri = `at://${communityDid}/xyz.atbbs.board/general`;
const postCollection = "xyz.atbbs.post";

function uri(did: string, rkey: string) {
  return `at://${did}/${postCollection}/${rkey}`;
}

function post(
  did: string,
  rkey: string,
  createdAt: string,
  fields: Record<string, unknown> = {},
) {
  return {
    uri: uri(did, rkey),
    cid: `cid-${rkey}`,
    value: {
      $type: postCollection,
      scope: boardUri,
      body: `Body ${rkey}`,
      createdAt,
      ...fields,
    },
  };
}

function ref(record: ReturnType<typeof post>) {
  const parts = record.uri.split("/");
  return {
    did: parts[2],
    collection: parts[3],
    rkey: parts[4],
  };
}

function moderation({
  banned = [],
  hidden = [],
}: {
  banned?: string[];
  hidden?: string[];
}): ModerationState {
  return {
    banRkeys: Object.fromEntries(banned.map((did) => [did, ["ban"]])),
    hideRkeys: Object.fromEntries(hidden.map((postUri) => [postUri, ["hide"]])),
  };
}

function installReadMock({
  records,
  backlinkPages,
}: {
  records: ReturnType<typeof post>[];
  backlinkPages: ReturnType<typeof ref>[][];
}) {
  const byRkey = new Map(records.map((record) => [ref(record).rkey, record]));
  const backlinkFetches: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("blue.microcosm.links.getBacklinks")) {
        const cursor = url.searchParams.get("cursor");
        const pageIndex = cursor ? Number(cursor) : 0;
        backlinkFetches.push(cursor ?? "first");
        const next =
          pageIndex + 1 < backlinkPages.length ? `${pageIndex + 1}` : null;
        return new Response(
          JSON.stringify({
            total: backlinkPages.flat().length,
            records: backlinkPages[pageIndex] ?? [],
            cursor: next,
          }),
        );
      }
      if (url.pathname.endsWith("blue.microcosm.links.getBacklinksCount")) {
        return new Response(JSON.stringify({ total: 0 }));
      }
      if (url.pathname.endsWith("blue.microcosm.identity.resolveMiniDoc")) {
        const did = url.searchParams.get("identifier");
        return new Response(
          JSON.stringify({
            did,
            handle: `${did}.example`,
            pds: "https://pds.example",
          }),
        );
      }
      const collection = url.searchParams.get("collection");
      if (collection === "app.bsky.actor.profile") {
        return new Response("missing", { status: 404 });
      }
      const record = byRkey.get(url.searchParams.get("rkey") ?? "");
      return record
        ? new Response(JSON.stringify(record))
        : new Response("missing", { status: 404 });
    }),
  );
  return backlinkFetches;
}

afterEach(() => vi.unstubAllGlobals());

describe("moderated thread pages", () => {
  it("does not let a hidden reply bump its thread", async () => {
    const firstRoot = post("did:plc:first", "first", "2026-01-01T00:00:00Z", {
      title: "First",
    });
    const secondRoot = post(
      "did:plc:second",
      "second",
      "2026-01-02T00:00:00Z",
      {
        title: "Second",
      },
    );
    const hiddenReply = post(
      "did:plc:reader",
      "hidden-reply",
      "2026-01-03T00:00:00Z",
      {
        root: firstRoot.uri,
      },
    );
    installReadMock({
      records: [firstRoot, secondRoot, hiddenReply],
      backlinkPages: [[ref(hiddenReply), ref(secondRoot), ref(firstRoot)]],
    });

    const result = await hydrateThreadPage(communityDid, "general", {
      moderation: moderation({ hidden: [hiddenReply.uri] }),
    });

    expect(result.threads.map((thread) => thread.uri)).toEqual([
      secondRoot.uri,
      firstRoot.uri,
    ]);
  });

  it("keeps unmoderated bump ordering unchanged", async () => {
    const firstRoot = post("did:plc:first", "first", "2026-01-01T00:00:00Z", {
      title: "First",
    });
    const secondRoot = post(
      "did:plc:second",
      "second",
      "2026-01-02T00:00:00Z",
      {
        title: "Second",
      },
    );
    const reply = post("did:plc:reader", "reply", "2026-01-03T00:00:00Z", {
      root: firstRoot.uri,
    });
    installReadMock({
      records: [firstRoot, secondRoot, reply],
      backlinkPages: [[ref(reply), ref(secondRoot), ref(firstRoot)]],
    });

    const result = await hydrateThreadPage(communityDid, "general");

    expect(result.threads.map((thread) => thread.uri)).toEqual([
      firstRoot.uri,
      secondRoot.uri,
    ]);
  });

  it("skips banned and hidden roots and scans on to fill the page", async () => {
    const bannedDid = "did:plc:banned";
    const blockedRoots = Array.from({ length: 25 }, (_, index) =>
      post(
        bannedDid,
        `blocked-${index}`,
        `2026-01-03T00:00:${String(index).padStart(2, "0")}Z`,
        {
          title: `Blocked ${index}`,
        },
      ),
    );
    const visibleRoots = Array.from({ length: 25 }, (_, index) =>
      post(
        "did:plc:visible",
        `visible-${index}`,
        `2026-01-02T00:00:${String(index).padStart(2, "0")}Z`,
        {
          title: `Visible ${index}`,
        },
      ),
    );
    const hiddenRoot = blockedRoots[0];
    const backlinkFetches = installReadMock({
      records: [...blockedRoots, ...visibleRoots],
      backlinkPages: [blockedRoots.map(ref), visibleRoots.map(ref)],
    });

    const result = await hydrateThreadPage(communityDid, "general", {
      moderation: moderation({ banned: [bannedDid], hidden: [hiddenRoot.uri] }),
    });

    expect(result.threads).toHaveLength(25);
    expect(
      result.threads.every((thread) => thread.did === "did:plc:visible"),
    ).toBe(true);
    expect(backlinkFetches).toEqual(["first", "1"]);
  });

  it("lets the sysop see moderated roots", async () => {
    const root = post("did:plc:banned", "root", "2026-01-01T00:00:00Z", {
      title: "Moderated",
    });
    installReadMock({ records: [root], backlinkPages: [[ref(root)]] });

    const result = await hydrateThreadPage(communityDid, "general", {
      moderation: moderation({
        banned: ["did:plc:banned"],
        hidden: [root.uri],
      }),
      viewerDid: communityDid,
    });

    expect(result.threads.map((thread) => thread.uri)).toEqual([root.uri]);
  });
});

describe("other moderated public reads", () => {
  it("filters news for anonymous callers and preserves sysop visibility", async () => {
    const visible = post(communityDid, "visible-news", "2026-01-01T00:00:00Z", {
      title: "Visible",
      scope: `at://${communityDid}/xyz.atbbs.site/self`,
    });
    const hidden = post(communityDid, "hidden-news", "2026-01-02T00:00:00Z", {
      title: "Hidden",
      scope: `at://${communityDid}/xyz.atbbs.site/self`,
    });
    installReadMock({
      records: [visible, hidden],
      backlinkPages: [[ref(hidden), ref(visible)]],
    });
    const state = moderation({ hidden: [hidden.uri] });

    await expect(
      fetchNews(communityDid, { moderation: state }),
    ).resolves.toMatchObject([{ uri: visible.uri }]);
    await expect(
      fetchNews(communityDid, { moderation: state, viewerDid: communityDid }),
    ).resolves.toHaveLength(2);
  });

  it("filters moderated replies and off-page parents for anonymous callers", async () => {
    const threadUri = uri("did:plc:author", "root");
    const parent = post("did:plc:parent", "parent", "2026-01-01T00:00:00Z", {
      root: threadUri,
    });
    const child = post("did:plc:child", "child", "2026-01-02T00:00:00Z", {
      root: threadUri,
      parent: parent.uri,
    });
    const bannedReply = post(
      "did:plc:banned",
      "banned",
      "2026-01-03T00:00:00Z",
      {
        root: threadUri,
      },
    );
    installReadMock({
      records: [parent, child, bannedReply],
      backlinkPages: [],
    });
    const state = moderation({
      banned: ["did:plc:banned"],
      hidden: [parent.uri],
    });

    const publicPage = await hydrateReplyPage(
      threadUri,
      [ref(child), ref(bannedReply)],
      {
        moderation: state,
      },
    );
    expect(publicPage.replies.map((reply) => reply.uri)).toEqual([child.uri]);
    expect(publicPage.parentReplies[parent.uri]).toBeUndefined();

    const sysopPage = await hydrateReplyPage(
      threadUri,
      [ref(child), ref(bannedReply)],
      {
        moderation: state,
        viewerDid: communityDid,
      },
    );
    expect(sysopPage.replies).toHaveLength(2);
    expect(sysopPage.parentReplies[parent.uri]?.uri).toBe(parent.uri);
  });
});
