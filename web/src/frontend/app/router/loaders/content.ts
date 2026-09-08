import type { LoaderFunctionArgs } from "react-router-dom";
import type { Board, Community } from "@atbbs/core/community";
import type { NewsPost, Thread } from "@atbbs/core/discussion";
import { bbsQuery } from "../../../features/community/queries";
import {
  newsQuery,
  threadRootQuery,
} from "../../../features/discussion/queries";
import { queryClient } from "../../../app/queryClient";
import { bbsModerationQuery } from "../../../features/moderation/queries";
import { ensureAuthReady, getCurrentUser } from "../../../features/auth/auth";
import type { DiscussionReadContext } from "../../../features/discussion/queries";

function requiredParam(
  params: LoaderFunctionArgs["params"],
  name: string,
): string {
  const value = params[name];
  if (!value) throw new Response("Not found", { status: 404 });
  return value;
}

export interface CommunityLoaderData {
  handle: string;
  bbs: Community;
}

async function loadCommunity(params: LoaderFunctionArgs["params"]) {
  const handle = requiredParam(params, "handle");
  const bbs = await queryClient.ensureQueryData(bbsQuery(handle));
  return { handle, bbs } satisfies CommunityLoaderData;
}

export async function communityLoader({ params }: LoaderFunctionArgs) {
  return loadCommunity(params);
}

export interface BoardLoaderData extends CommunityLoaderData {
  board: Board;
  readContext: DiscussionReadContext;
}

async function loadDiscussionReadContext(
  bbs: Community,
): Promise<DiscussionReadContext> {
  await ensureAuthReady();
  const moderationQuery = bbsModerationQuery(
    bbs.identity.pds ?? "",
    bbs.identity.did,
  );
  let moderation;
  try {
    moderation = await queryClient.fetchQuery(moderationQuery);
  } catch (error) {
    moderation = queryClient.getQueryData(moderationQuery.queryKey);
    if (!moderation) throw error;
  }
  const viewerDid = getCurrentUser()?.did;
  return {
    moderation,
    audience: viewerDid === bbs.identity.did ? "sysop" : "public",
    viewerDid,
  };
}

export async function boardLoader({ params }: LoaderFunctionArgs) {
  const { handle, bbs } = await loadCommunity(params);
  const slug = requiredParam(params, "slug");
  const board = bbs.site.boards.find((candidate) => candidate.slug === slug);
  if (!board) throw new Response("Board not found", { status: 404 });
  const readContext = await loadDiscussionReadContext(bbs);
  return { handle, bbs, board, readContext } satisfies BoardLoaderData;
}

export interface ThreadLoaderData extends CommunityLoaderData {
  thread: Thread;
  readContext: DiscussionReadContext;
}

export async function threadLoader({ params }: LoaderFunctionArgs) {
  const { handle, bbs } = await loadCommunity(params);
  const did = requiredParam(params, "did");
  const tid = requiredParam(params, "tid");
  const readContext = await loadDiscussionReadContext(bbs);
  const thread = await queryClient.ensureQueryData(
    threadRootQuery(bbs.identity.did, did, tid, readContext),
  );
  return { handle, bbs, thread, readContext } satisfies ThreadLoaderData;
}

export interface NewsLoaderData extends CommunityLoaderData {
  item: NewsPost;
}

export async function newsLoader({ params }: LoaderFunctionArgs) {
  const { handle, bbs } = await loadCommunity(params);
  const tid = requiredParam(params, "tid");
  const news = await queryClient.ensureQueryData(newsQuery(bbs.identity.did));
  const item = news.find((candidate) => candidate.rkey === tid);
  if (!item) throw new Response("News post not found", { status: 404 });
  return { handle, bbs, item } satisfies NewsLoaderData;
}
