import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAndHydrate } from "../discussion/hydration";
import { resolveIdentitiesBatch } from "../identity/service";
import { listRecords } from "../../atproto/records";
import { fetchActivity } from "./activity";

vi.mock("../discussion/hydration", () => ({ fetchAndHydrate: vi.fn() }));
vi.mock("../identity/service", () => ({ resolveIdentitiesBatch: vi.fn() }));
vi.mock("../../atproto/records", () => ({ listRecords: vi.fn() }));

const ownerDid = "did:plc:owner";
const bbsDid = "did:plc:bbs";

function post(index: number, isReply: boolean) {
  const rkey = `${isReply ? "reply" : "root"}-${index}`;
  return {
    uri: `at://${ownerDid}/xyz.atbbs.post/${rkey}`,
    cid: `cid-${rkey}`,
    value: {
      $type: "xyz.atbbs.post",
      scope: `at://${bbsDid}/xyz.atbbs.board/general`,
      title: isReply ? undefined : `Thread ${index}`,
      body: "Body",
      createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      ...(isReply ? { root: `at://${ownerDid}/xyz.atbbs.post/root-0` } : {}),
    },
  };
}

beforeEach(() => {
  vi.mocked(resolveIdentitiesBatch).mockResolvedValue({
    [bbsDid]: { did: bbsDid, handle: "bbs.example", pds: "pds" },
  });
});

describe("activity fan-out", () => {
  it("bounds requests and keeps ordered, deduplicated partial results", async () => {
    vi.mocked(listRecords).mockResolvedValue({
      items: [
        ...Array.from({ length: 7 }, (_, index) => post(index, false)),
        ...Array.from({ length: 6 }, (_, index) => post(index, true)),
      ],
      truncated: false,
      nextCursor: null,
    });

    let active = 0;
    let peak = 0;
    vi.mocked(fetchAndHydrate).mockImplementation(async (sourceUri) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active--;
      if (sourceUri.endsWith("root-6")) throw new Error("unavailable");

      const sourceRkey = sourceUri.split("/").at(-1)!;
      const duplicate = sourceRkey === "root-0" || sourceRkey === "reply-0";
      const replyRkey = duplicate ? "same" : `for-${sourceRkey}`;
      const day = sourceRkey === "root-1" ? "30" : "10";
      return {
        records: [
          {
            uri: `at://did:plc:other/xyz.atbbs.post/${replyRkey}`,
            did: "did:plc:other",
            rkey: replyRkey,
            handle: "other.example",
            pds: "pds",
            value: {
              body: sourceRkey,
              createdAt: `2026-02-${day}T00:00:00Z`,
            },
          },
        ],
        cursor: null,
      };
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await fetchActivity(ownerDid, "https://pds.example");

    expect(peak).toBeLessThanOrEqual(5);
    expect(result[0].body).toBe("root-1");
    expect(result.filter((item) => item.replyUri.endsWith("/same"))).toEqual([
      expect.objectContaining({ type: "parent_reply" }),
    ]);
    expect(result).toHaveLength(11);
    expect(warning).toHaveBeenCalledWith(
      "Activity lookup completed with 1 partial failure(s)",
      expect.any(Array),
    );
  });
});
