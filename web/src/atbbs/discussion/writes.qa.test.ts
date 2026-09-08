import { describe, expect, it, vi } from "vitest";

import { createThread } from "./threads";
import type { AuthenticatedRepo } from "../../atproto/repository";
import { uploadAttachments } from "./attachments";

describe("authenticated writes", () => {
  it("constructs the externally persisted post record", async () => {
    const data = {
      uri: "at://did:plc:test/xyz.atbbs.post/example",
      cid: "cid",
      validationStatus: "valid" as const,
    };
    const post = vi.fn(async () => ({ ok: true, data }));
    const repo = {
      did: "did:plc:test",
      client: { post },
    } as unknown as AuthenticatedRepo;
    await expect(
      createThread(repo, "https://pds.example", {
        communityDid: "did:plc:community",
        boardSlug: "general",
        title: "Title",
        body: "body",
        attachments: [],
      }),
    ).resolves.toMatchObject({
      uri: data.uri,
      did: "did:plc:test",
      rkey: "example",
      attachments: [],
    });
    expect(post).toHaveBeenCalledWith("com.atproto.repo.createRecord", {
      input: {
        repo: "did:plc:test",
        collection: "xyz.atbbs.post",
        record: {
          $type: "xyz.atbbs.post",
          scope: "at://did:plc:community/xyz.atbbs.board/general",
          title: "Title",
          body: "body",
          createdAt: expect.any(String),
        },
      },
    });
  });

  it("skips empty attachments before reading them", async () => {
    const post = vi.fn();
    const read = vi.fn();
    const repo = {
      did: "did:plc:test",
      client: { post },
    } as unknown as AuthenticatedRepo;

    await expect(
      uploadAttachments(repo, [
        { name: "empty.txt", mediaType: "text/plain", originalSize: 0, read },
      ]),
    ).resolves.toEqual([]);
    expect(read).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("uploads attachments sequentially with their bytes and media types", async () => {
    const calls: string[] = [];
    const requests: Array<{
      input: Uint8Array;
      headers?: Record<string, string>;
    }> = [];
    const repo = {
      did: "did:plc:test",
      client: {
        post: vi.fn(
          async (
            _method: string,
            request: { input: Uint8Array; headers?: Record<string, string> },
          ) => {
            requests.push(request);
            calls.push(`upload-${request.input[0]}`);
            return {
              ok: true,
              data: {
                blob: {
                  $type: "blob",
                  ref: { $link: `cid-${request.input[0]}` },
                  mimeType: request.headers?.["content-type"] ?? "",
                  size: 1,
                },
              },
            };
          },
        ),
      },
    } as unknown as AuthenticatedRepo;

    const attachments = await uploadAttachments(repo, [
      {
        name: "first.txt",
        mediaType: "text/markdown",
        originalSize: 1,
        read: async () => {
          calls.push("read-1");
          return new Uint8Array([1]);
        },
      },
      {
        name: "second.txt",
        mediaType: "application/json",
        originalSize: 1,
        read: async () => {
          calls.push("read-2");
          return new Uint8Array([2]);
        },
      },
    ]);

    expect(calls).toEqual(["read-1", "upload-1", "read-2", "upload-2"]);
    expect(requests.map((request) => [...request.input])).toEqual([[1], [2]]);
    expect(requests.map((request) => request.headers)).toEqual([
      { "content-type": "text/markdown" },
      { "content-type": "application/json" },
    ]);
    expect(attachments.map((attachment) => attachment.name)).toEqual([
      "first.txt",
      "second.txt",
    ]);
  });
});
