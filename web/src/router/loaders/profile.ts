import type { LoaderFunctionArgs } from "react-router-dom";
import { fetchProfile, type Profile } from "../../lib/profile";
import { fetchMyThreads, type MyThread } from "../../lib/mythreads";

export async function profileLoader({ params }: LoaderFunctionArgs) {
  const handle = params.handle!;
  const profile = await fetchProfile(handle);

  let threads: Promise<MyThread[]> = Promise.resolve([]);
  if (profile) {
    threads = fetchMyThreads(profile.pdsUrl, profile.did);
  }

  return { handle, profile, threads };
}

export type ProfileLoaderData = {
  handle: string;
  profile: Profile | null;
  threads: Promise<MyThread[]>;
};
