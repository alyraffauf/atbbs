import { STALE_SLOW } from "../../app/queryClient";

export const slowQueryOptions = {
  staleTime: STALE_SLOW,
  refetchOnMount: true,
} as const;
