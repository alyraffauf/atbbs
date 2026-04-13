import type { LoaderFunctionArgs } from "react-router-dom";
import { resolveBBS, type BBS } from "../../lib/bbs";

export async function bbsLoader({ params }: LoaderFunctionArgs) {
  const handle = params.handle!;
  const bbs = await resolveBBS(handle);
  return { handle, bbs };
}

export type BBSLoaderData = { handle: string; bbs: BBS };
