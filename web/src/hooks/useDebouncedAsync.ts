import { useEffect, useState } from "react";

interface UseDebouncedAsyncOptions<Input, Result> {
  input: Input;
  enabled: boolean;
  delay: number;
  loader: (input: Input) => Promise<Result>;
  emptyValue: Result;
}

export function useDebouncedAsync<Input, Result>({
  input,
  enabled,
  delay,
  loader,
  emptyValue,
}: UseDebouncedAsyncOptions<Input, Result>): Result {
  const [result, setResult] = useState(emptyValue);

  useEffect(() => {
    if (!enabled) {
      setResult(emptyValue);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const loaded = await loader(input);
        if (!cancelled) setResult(loaded);
      } catch {
        if (!cancelled) setResult(emptyValue);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [delay, emptyValue, enabled, input, loader]);

  return result;
}
