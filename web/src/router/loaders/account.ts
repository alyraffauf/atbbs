import { redirect } from "react-router-dom";
import { NoBBSError } from "../../lib/bbs";
import { bbsQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { requireAuth } from "./auth";

/** Loader for /account/create — just gates the route on auth. */
export async function requireAuthLoader() {
  await requireAuth();
  return null;
}

/** Loader for /account/edit and /account/moderate — requires auth AND an
 *  existing BBS. Warms the Query cache so the page's useSuspenseQuery
 *  lands on fresh data with no flash. */
export async function requireSysopBBSLoader() {
  const user = await requireAuth();
  try {
    await queryClient.ensureQueryData(bbsQuery(user.handle));
  } catch (error) {
    if (error instanceof NoBBSError) throw redirect("/account/create");
    throw error;
  }
  return null;
}
