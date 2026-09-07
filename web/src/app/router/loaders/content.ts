import type { LoaderFunctionArgs } from "react-router-dom";
import type {
  Board,
  Community,
  NewsPost,
} from "../../../atbbs/community/read";
import type { ThreadRoot } from "../../../features/discussion/data/thread";
import { bbsQuery } from "../../../frontend/features/community/queries";
import {
  newsQuery,
  threadRootQuery,
} from "../../../frontend/features/discussion/queries";
import { queryClient } from "../../../frontend/app/queryClient";

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
}

export async function boardLoader({ params }: LoaderFunctionArgs) {
  const { handle, bbs } = await loadCommunity(params);
  const slug = requiredParam(params, "slug");
  const board = bbs.site.boards.find((candidate) => candidate.slug === slug);
  if (!board) throw new Response("Board not found", { status: 404 });
  return { handle, bbs, board } satisfies BoardLoaderData;
}

export interface ThreadLoaderData extends CommunityLoaderData {
  thread: ThreadRoot;
}

export async function threadLoader({ params }: LoaderFunctionArgs) {
  const { handle, bbs } = await loadCommunity(params);
  const did = requiredParam(params, "did");
  const tid = requiredParam(params, "tid");
  const thread = await queryClient.ensureQueryData(
    threadRootQuery(bbs.identity.did, did, tid),
  );
  return { handle, bbs, thread } satisfies ThreadLoaderData;
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
