import type { LoaderFunctionArgs } from "react-router-dom";
import { resolveBBS } from "../../lib/bbs";
import {
  getRecord,
  getBacklinks,
  resolveIdentity,
  type BacklinkRef,
} from "../../lib/atproto";
import { POST } from "../../lib/lexicon";
import { makeAtUri, parseAtUri } from "../../lib/util";
import { is } from "@atcute/lexicons/validations";
import { mainSchema as postSchema } from "../../lexicons/types/xyz/atbbs/post";
import type { XyzAtbbsPost } from "../../lexicons";

export interface ThreadObj {
  uri: string;
  did: string;
  rkey: string;
  authorHandle: string;
  authorPds: string;
  title: string;
  body: string;
  createdAt: string;
  boardSlug: string;
  attachments?: { file: { ref: { $link: string } }; name: string }[];
}

async function collectAllReplyRefs(rootUri: string): Promise<BacklinkRef[]> {
  const collected: BacklinkRef[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await getBacklinks(rootUri, `${POST}:root`, 100, cursor);
    collected.push(...page.records);
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  return collected.reverse(); // oldest first
}

export async function threadLoader({ params }: LoaderFunctionArgs) {
  const handle = params.handle!;
  const did = params.did!;
  const tid = params.tid!;

  const threadUri = makeAtUri(did, POST, tid);
  const [bbs, threadRecord, author, allRefs] = await Promise.all([
    resolveBBS(handle),
    getRecord(did, POST, tid),
    resolveIdentity(did),
    collectAllReplyRefs(threadUri),
  ]);
  if (!is(postSchema, threadRecord.value)) {
    throw new Response("Invalid post record", { status: 404 });
  }
  const postValue = threadRecord.value as unknown as XyzAtbbsPost.Main;
  const boardSlug = parseAtUri(postValue.scope).rkey;
  const thread: ThreadObj = {
    uri: threadRecord.uri,
    did,
    rkey: tid,
    authorHandle: author.handle,
    authorPds: author.pds ?? "",
    title: postValue.title ?? "",
    body: postValue.body,
    createdAt: postValue.createdAt,
    boardSlug,
    attachments: postValue.attachments as ThreadObj["attachments"],
  };

  return { handle, bbs, thread, allRefs };
}
