import { STALE_SLOW } from "../queryClient";

export const slowQueryOptions = {
  staleTime: STALE_SLOW,
  refetchOnMount: true,
} as const;
