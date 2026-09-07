// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedAsync } from "./useDebouncedAsync";

const EMPTY = "empty";

function renderLookup(
  loader: (input: string) => Promise<string>,
  input = "first",
  enabled = true,
) {
  return renderHook(
    ({ currentInput, isEnabled }) =>
      useDebouncedAsync({
        input: currentInput,
        enabled: isEnabled,
        delay: 300,
        loader,
        emptyValue: EMPTY,
      }),
    { initialProps: { currentInput: input, isEnabled: enabled } },
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useDebouncedAsync", () => {
  it("waits for the configured delay before loading", async () => {
    const loader = vi.fn(async (input: string) => `loaded ${input}`);
    const { result } = renderLookup(loader);
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(loader).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(loader).toHaveBeenCalledWith("first");
    expect(result.current).toBe("loaded first");
  });

  it("clears immediately when disabled", async () => {
    const loader = vi.fn(async () => "loaded");
    const { result, rerender } = renderLookup(loader);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current).toBe("loaded");
    rerender({ currentInput: "", isEnabled: false });
    expect(result.current).toBe(EMPTY);
  });

  it("ignores stale results that resolve out of order", async () => {
    const resolvers = new Map<string, (value: string) => void>();
    const loader = vi.fn(
      (input: string) =>
        new Promise<string>((resolve) => resolvers.set(input, resolve)),
    );
    const { result, rerender } = renderLookup(loader);
    await act(() => vi.advanceTimersByTimeAsync(300));
    rerender({ currentInput: "second", isEnabled: true });
    await act(() => vi.advanceTimersByTimeAsync(300));
    await act(async () => resolvers.get("second")!("new result"));
    await act(async () => resolvers.get("first")!("stale result"));
    expect(result.current).toBe("new result");
  });
});
