import type { LoaderFunctionArgs } from "react-router-dom";
import { resolveBBS, type BBS } from "../../lib/bbs";
import {
  getBacklinks,
  getRecordsBatch,
  resolveIdentitiesBatch,
  type ATRecord,
} from "../../lib/atproto";
import { POST, BOARD } from "../../lib/lexicon";
import { makeAtUri, parseAtUri } from "../../lib/util";
import { is } from "@atcute/lexicons/validations";
import { mainSchema as postSchema } from "../../lexicons/types/xyz/atbbs/post";
import type { XyzAtbbsPost } from "../../lexicons";

export interface ThreadItem {
  uri: string;
  did: string;
  rkey: string;
  handle: string;
  title: string;
  body: string;
  createdAt: string;
}

export async function hydrateThreadPage(
  bbs: BBS,
  slug: string,
  cursor?: string,
): Promise<{ threads: ThreadItem[]; cursor: string | null }> {
  const boardUri = makeAtUri(bbs.identity.did, BOARD, slug);
  const backlinks = await getBacklinks(boardUri, `${POST}:scope`, 50, cursor);
  const records = await getRecordsBatch(backlinks.records);
  const filtered = records.filter((record) => {
    if (!is(postSchema, record.value)) return false;
    const value = record.value as unknown as XyzAtbbsPost.Main;
    return value.title && !value.root; // root posts with titles = threads
  });
  const authors = await resolveIdentitiesBatch(
    filtered.map((record) => parseAtUri(record.uri).did),
  );
  const threads: ThreadItem[] = filtered
    .filter((record) => parseAtUri(record.uri).did in authors)
    .map((record: ATRecord) => {
      const { did, rkey } = parseAtUri(record.uri);
      const value = record.value as unknown as XyzAtbbsPost.Main;
      return {
        uri: record.uri,
        did,
        rkey,
        handle: authors[did].handle,
        title: value.title ?? "",
        body: value.body,
        createdAt: value.createdAt,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { threads, cursor: backlinks.cursor ?? null };
}

export async function boardLoader({ params }: LoaderFunctionArgs) {
  const handle = params.handle!;
  const slug = params.slug!;
  const bbs = await resolveBBS(handle);
  const board = bbs.site.boards.find((board) => board.slug === slug);
  if (!board) throw new Response("Board not found", { status: 404 });

  const { threads, cursor } = await hydrateThreadPage(bbs, slug);
  return { handle, bbs, board, threads, cursor };
}
