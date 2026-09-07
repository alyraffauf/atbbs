import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthenticatedRepo } from "../../atproto/repository";
import { FetchError } from "../../atproto/transport";
import { createAtbbsWriter } from "../writer";
import { fetchProfile } from "../profile/read";
import { deleteBBS } from "./delete";
import { fetchHomeSysopInfo } from "./home";
import { resolveCommunity } from "./read";

const did = "did:plc:sysop";
const oldCreatedAt = "2025-01-01T00:00:00.000Z";

interface RecordRequest {
  input: {
    collection: string;
    rkey?: string;
    record: Record<string, unknown>;
  };
}

function record(uri: string, value: Record<string, unknown>) {
  return { uri, cid: `cid-${uri}`, value };
}

function siteRecord(boardUris = [`at://${did}/xyz.atbbs.board/general`]) {
  return record(`at://${did}/xyz.atbbs.site/self`, {
    $type: "xyz.atbbs.site",
    name: "Community",
    description: "Description",
    intro: "Welcome",
    boards: boardUris,
    createdAt: oldCreatedAt,
  });
}

function boardRecord() {
  return record(`at://${did}/xyz.atbbs.board/general`, {
    $type: "xyz.atbbs.board",
    name: "General",
    description: "Everything",
    createdAt: oldCreatedAt,
  });
}

function repoWithPost(
  post = vi.fn(async (_method: string, _request: RecordRequest) => ({
    ok: true,
    data: {},
  })),
) {
  return { did, client: { post } } as unknown as AuthenticatedRepo;
}

afterEach(() => vi.unstubAllGlobals());

describe("community writes", () => {
  it("preserves board creation times and stamps updates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        return new Response(
          JSON.stringify(
            url.searchParams.get("collection") === "xyz.atbbs.site"
              ? siteRecord()
              : boardRecord(),
          ),
        );
      }),
    );
    const post = vi.fn(async (_method: string, _request: RecordRequest) => ({
      ok: true,
      data: {},
    }));
    const writer = createAtbbsWriter(repoWithPost(post), "https://pds.example");

    await writer.updateCommunity({
      name: "Renamed",
      description: "Changed",
      intro: "Hello",
      boards: [
        { slug: "general", name: "General", description: "Updated" },
        { slug: "new", name: "New", description: "New board" },
      ],
    });

    const requests = post.mock.calls.map(([, request]) => request.input);
    const general = requests.find((request) => request.rkey === "general")!;
    const added = requests.find((request) => request.rkey === "new")!;
    const site = requests.find(
      (request) => request.collection === "xyz.atbbs.site",
    )!;
    expect(general.record.createdAt).toBe(oldCreatedAt);
    expect(general.record.updatedAt).toEqual(expect.any(String));
    expect(added.record.createdAt).toBe(added.record.updatedAt);
    expect(site.record.createdAt).toBe(oldCreatedAt);
    expect(site.record.updatedAt).toEqual(expect.any(String));
  });

  it.each([
    [`at://did:plc:other/xyz.atbbs.board/general`, "foreign owner"],
    [`at://${did}/xyz.atbbs.post/general`, "wrong collection"],
  ])("rejects a %s board reference before updating", async (boardUri) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(siteRecord([boardUri])))),
    );
    const post = vi.fn(async (_method: string, _request: RecordRequest) => ({
      ok: true,
      data: {},
    }));
    const writer = createAtbbsWriter(repoWithPost(post), "https://pds.example");

    await expect(
      writer.updateCommunity({
        name: "Community",
        description: "Description",
        intro: "Welcome",
        boards: [{ slug: "general", name: "General", description: "" }],
      }),
    ).rejects.toMatchObject<Partial<FetchError>>({ kind: "malformed" });
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects foreign board references before deleting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify(
              siteRecord(["at://did:plc:other/xyz.atbbs.board/general"]),
            ),
          ),
      ),
    );
    const post = vi.fn(async (_method: string, _request: RecordRequest) => ({
      ok: true,
      data: {},
    }));

    await expect(
      deleteBBS(repoWithPost(post), did, "https://pds.example"),
    ).rejects.toMatchObject<Partial<FetchError>>({ kind: "malformed" });
    expect(post).not.toHaveBeenCalled();
  });
});

describe("community reads", () => {
  it("treats only a missing site record as no community", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );
    await expect(fetchHomeSysopInfo(did)).resolves.toEqual({
      hasBBS: false,
      bbsName: null,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );
    await expect(fetchHomeSysopInfo(did)).rejects.toMatchObject<
      Partial<FetchError>
    >({ kind: "server" });
  });

  it("rejects a malformed site instead of reporting no community", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("resolveMiniDoc")) {
          return new Response(
            JSON.stringify({ did, handle: "sysop.example", pds: "pds" }),
          );
        }
        return new Response(
          JSON.stringify(record(`at://${did}/xyz.atbbs.site/self`, {})),
        );
      }),
    );

    await expect(resolveCommunity("sysop.example")).rejects.toMatchObject<
      Partial<FetchError>
    >({ kind: "malformed" });
  });
});

describe("profile reads", () => {
  it("returns null only when the identity is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );
    await expect(fetchProfile("missing.example")).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 500 })),
    );
    await expect(fetchProfile("offline.example")).rejects.toMatchObject<
      Partial<FetchError>
    >({ kind: "server" });
  });

  it("rejects malformed profile records", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("resolveMiniDoc")) {
          return new Response(
            JSON.stringify({ did, handle: "sysop.example", pds: "pds" }),
          );
        }
        if (url.searchParams.get("collection") === "xyz.atbbs.profile") {
          return new Response(
            JSON.stringify(record(`at://${did}/xyz.atbbs.profile/self`, {})),
          );
        }
        return new Response("missing", { status: 404 });
      }),
    );

    await expect(fetchProfile("sysop.example")).rejects.toMatchObject<
      Partial<FetchError>
    >({ kind: "malformed" });
  });
});
