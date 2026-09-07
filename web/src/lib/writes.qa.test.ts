import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedRepo } from "./repository";
import { createPost, uploadAttachments } from "./writes";

describe("authenticated writes", () => {
  it("throws when the PDS rejects a write", async () => {
    const repo = {
      did: "did:plc:test",
      client: {
        post: vi.fn(async () => ({
          ok: false,
          status: 400,
          headers: new Headers(),
          data: { error: "InvalidRequest", message: "rejected" },
        })),
      },
    } as unknown as AuthenticatedRepo;
    await expect(createPost(repo, "at://scope", "body")).rejects.toThrow(
      "rejected",
    );
  });

  it("returns unwrapped record data", async () => {
    const data = {
      uri: "at://did:plc:test/xyz.atbbs.post/example",
      cid: "cid",
      validationStatus: "valid" as const,
    };
    const repo = {
      did: "did:plc:test",
      client: { post: vi.fn(async () => ({ ok: true, data })) },
    } as unknown as AuthenticatedRepo;
    await expect(createPost(repo, "at://scope", "body")).resolves.toBe(data);
  });

  it("passes the cleaned File directly to blob upload", async () => {
    const post = vi.fn(async () => ({
      ok: true,
      data: {
        blob: {
          $type: "blob",
          ref: { $link: "blob-cid" },
          mimeType: "text/plain",
          size: 4,
        },
      },
    }));
    const repo = {
      did: "did:plc:test",
      client: { post },
    } as unknown as AuthenticatedRepo;
    const file = new File(["test"], "test.txt", { type: "text/plain" });
    await uploadAttachments(repo, [file]);
    const request = post.mock.calls[0] as unknown as [
      string,
      { input: File },
    ];
    expect(request[1]).toMatchObject({ input: file });
  });
});
