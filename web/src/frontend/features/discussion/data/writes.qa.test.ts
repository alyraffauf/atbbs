import { describe, expect, it, vi } from "vitest";

import { createThread } from "../../../../atbbs/discussion/commands";
import type { AuthenticatedRepo } from "../../../../atproto/repository";
import {
  prepareAttachmentViews,
  uploadAttachments,
} from "../../../../atbbs/discussion/attachments";

describe("authenticated writes", () => {
  it("prepares JSON-safe attachment URLs without exposing blob references", () => {
    const views = prepareAttachmentViews(
      [
        {
          name: "photo.jpg",
          file: {
            $type: "blob",
            ref: { $link: "blob-cid" },
            mimeType: "image/jpeg",
            size: 12,
          },
        },
      ],
      "did:plc:author",
      "https://pds.example",
    );

    expect(views).toEqual([
      {
        name: "photo.jpg",
        downloadUrl:
          "https://pds.example/xrpc/com.atproto.sync.getBlob?did=did:plc:author&cid=blob-cid",
        imageUrl:
          "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:author/blob-cid@webp",
      },
    ]);
    expect(JSON.stringify(views)).not.toContain("$link");
  });

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
    await expect(
      createThread(repo, "https://pds.example", {
        communityDid: "did:plc:community",
        boardSlug: "general",
        title: "Title",
        body: "body",
        attachments: [],
      }),
    ).rejects.toThrow("rejected");
  });

  it("returns unwrapped record data", async () => {
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

  it("uploads prepared bytes with the original media type", async () => {
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
    const read = vi.fn(async () => new Uint8Array([1, 2, 3, 4]));
    await uploadAttachments(repo, [
      {
        name: "test.txt",
        mediaType: "text/plain",
        originalSize: 4,
        read,
      },
    ]);
    const request = post.mock.calls[0] as unknown as [
      string,
      { input: Uint8Array; headers: Record<string, string> },
    ];
    expect(request[0]).toBe("com.atproto.repo.uploadBlob");
    expect([...request[1].input]).toEqual([1, 2, 3, 4]);
    expect(request[1].headers).toEqual({ "content-type": "text/plain" });
    expect(read).toHaveBeenCalledOnce();
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

  it("uploads attachments sequentially in input order", async () => {
    const calls: string[] = [];
    const repo = {
      did: "did:plc:test",
      client: {
        post: vi.fn(async (_method: string, request: { input: Uint8Array }) => {
          calls.push(`upload-${request.input[0]}`);
          return {
            ok: true,
            data: {
              blob: {
                $type: "blob",
                ref: { $link: `cid-${request.input[0]}` },
                mimeType: "text/plain",
                size: 1,
              },
            },
          };
        }),
      },
    } as unknown as AuthenticatedRepo;

    const attachments = await uploadAttachments(repo, [
      {
        name: "first.txt",
        mediaType: "text/plain",
        originalSize: 1,
        read: async () => {
          calls.push("read-1");
          return new Uint8Array([1]);
        },
      },
      {
        name: "second.txt",
        mediaType: "text/plain",
        originalSize: 1,
        read: async () => {
          calls.push("read-2");
          return new Uint8Array([2]);
        },
      },
    ]);

    expect(calls).toEqual(["read-1", "upload-1", "read-2", "upload-2"]);
    expect(attachments.map((attachment) => attachment.name)).toEqual([
      "first.txt",
      "second.txt",
    ]);
  });
});
