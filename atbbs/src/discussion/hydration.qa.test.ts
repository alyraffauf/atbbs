import { afterEach, describe, expect, it, vi } from "vitest";
import { getBacklinkCountsBatch } from "./hydration";

afterEach(() => vi.unstubAllGlobals());

describe("backlink count hydration", () => {
  it("bounds concurrent count requests", async () => {
    let activeRequests = 0;
    let peakRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        activeRequests++;
        peakRequests = Math.max(peakRequests, activeRequests);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeRequests--;
        return new Response(JSON.stringify({ total: 1 }));
      }),
    );

    const subjects = Array.from(
      { length: 12 },
      (_, index) => `at://did:plc:${index}/xyz.atbbs.post/post`,
    );
    const counts = await getBacklinkCountsBatch(
      subjects,
      "xyz.atbbs.post:root",
    );

    expect(peakRequests).toBeLessThanOrEqual(10);
    expect(Object.keys(counts)).toHaveLength(12);
  });
});
