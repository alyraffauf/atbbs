import { redirect } from "react-router-dom";
import { NoBBSError } from "../../../atbbs/community/read";
import { bbsQuery } from "../../../frontend/features/community/queries";
import { queryClient } from "../../../frontend/app/queryClient";
import { requireAuth } from "../../../features/auth/loaders";

export async function requireNoBBSLoader() {
  const user = await requireAuth();
  try {
    await queryClient.ensureQueryData(bbsQuery(user.handle));
    throw redirect(`/bbs/${encodeURIComponent(user.handle)}`);
  } catch (error) {
    if (error instanceof NoBBSError) return null;
    throw error;
  }
}

/** Loader for /account/edit and /account/moderate — requires auth AND an
 *  existing BBS. Warms the Query cache so the page's useSuspenseQuery
 *  lands on fresh data with no flash. */
export async function requireSysopBBSLoader() {
  const user = await requireAuth();
  let bbs;
  try {
    bbs = await queryClient.ensureQueryData(bbsQuery(user.handle));
  } catch (error) {
    if (error instanceof NoBBSError) throw redirect("/account/create");
    throw error;
  }
  return { user, bbs };
}

export type SysopBBSLoaderData = Awaited<
  ReturnType<typeof requireSysopBBSLoader>
>;
