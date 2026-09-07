import { describe, expect, it, vi } from "vitest";

import { allSettledBounded } from "./batch";

describe("bounded work", () => {
  it("preserves input order when work finishes out of order", async () => {
    const pending = new Map<number, () => void>();
    const resultsPromise = allSettledBounded(
      [1, 2, 3],
      (value) =>
        new Promise<number>((resolve) => pending.set(value, () => resolve(value))),
      3,
    );
    await vi.waitFor(() => expect(pending.size).toBe(3));
    pending.get(3)!();
    pending.get(1)!();
    pending.get(2)!();
    expect(await resultsPromise).toEqual([
      { status: "fulfilled", value: 1 },
      { status: "fulfilled", value: 2 },
      { status: "fulfilled", value: 3 },
    ]);
  });
});
