import { queryOptions } from "@tanstack/react-query";
import { fetchProfile } from "../../../features/profile/data/profile";
import { slowQueryOptions } from "../../app/queryOptions";

export const profileQuery = (handle: string) =>
  queryOptions({
    ...slowQueryOptions,
    queryKey: ["profile", handle] as const,
    queryFn: () => fetchProfile(handle),
  });
