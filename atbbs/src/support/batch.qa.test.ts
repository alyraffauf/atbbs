import { describe, expect, it } from "vitest";
import { allSettledBounded } from "./batch";

describe("allSettledBounded", () => {
  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects invalid concurrency %s",
    async (concurrency) => {
      await expect(
        allSettledBounded(["value"], async (value) => value, concurrency),
      ).rejects.toThrow(RangeError);
    },
  );

  it("limits concurrent workers", async () => {
    let activeWorkers = 0;
    let peakWorkers = 0;
    const results = await allSettledBounded(
      [1, 2, 3, 4],
      async (value) => {
        activeWorkers++;
        peakWorkers = Math.max(peakWorkers, activeWorkers);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeWorkers--;
        return value;
      },
      2,
    );
    expect(peakWorkers).toBe(2);
    expect(results).toHaveLength(4);
  });
});
