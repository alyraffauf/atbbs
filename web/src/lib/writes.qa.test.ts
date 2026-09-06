import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedRepo } from "./repository";
import { createPost } from "./writes";

describe("authenticated writes", () => {
  it("throws when the PDS rejects a write", async () => {
    const repo = {
      did: "did:plc:test",
      client: {
        post: vi.fn(async () => ({ ok: false, data: { message: "rejected" } })),
      },
    } as unknown as AuthenticatedRepo;
    await expect(createPost(repo, "at://scope", "body")).rejects.toThrow(
      "rejected",
    );
  });
});
