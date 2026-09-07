import { queryOptions } from "@tanstack/react-query";
import { fetchProfile } from "./profile";
import { slowQueryOptions } from "../../../shared/queries/options";

export const profileQuery = (handle: string) =>
  queryOptions({
    ...slowQueryOptions,
    queryKey: ["profile", handle] as const,
    queryFn: () => fetchProfile(handle),
  });
