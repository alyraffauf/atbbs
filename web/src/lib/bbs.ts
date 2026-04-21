/** Resolve a handle to a fully hydrated BBS via Slingshot/Constellation. */

import { TTLCache } from "./cache";
import {
  getRecord,
  getRecordsBatch,
  getBacklinks,
  resolveIdentity,
  type MiniDoc,
  type ATRecord,
} from "./atproto";
import { SITE, BOARD, POST, BAN, HIDE } from "./lexicon";
import { makeAtUri, parseAtUri } from "./util";
import { is } from "@atcute/lexicons/validations";
import { mainSchema as siteSchema } from "../lexicons/types/xyz/atbbs/site";
import { mainSchema as boardSchema } from "../lexicons/types/xyz/atbbs/board";
import { mainSchema as postSchema } from "../lexicons/types/xyz/atbbs/post";
import type { XyzAtbbsSite, XyzAtbbsBoard, XyzAtbbsPost } from "../lexicons";

export class BBSNotFoundError extends Error {}
export class NoBBSError extends Error {}
export class NetworkError extends Error {}

export interface Board {
  slug: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PostAttachment {
  file: { ref: { $link: string } };
  name: string;
}

export interface NewsPost {
  uri: string;
  rkey: string;
  title: string;
  body: string;
  createdAt: string;
  attachments?: PostAttachment[];
}

export interface Site {
  name: string;
  description: string;
  intro: string;
  boards: Board[];
  createdAt: string;
  updatedAt?: string;
}

export interface BBS {
  identity: MiniDoc;
  site: Site;
  news: NewsPost[];
}

const bbsCache = new TTLCache<string, BBS>(5 * 60 * 1000);

export function invalidateBBSCache() {
  bbsCache.clear();
}

export async function resolveBBS(handle: string): Promise<BBS> {
  const cached = bbsCache.get(handle);
  if (cached) return cached;
  const bbs = await _resolveBBS(handle);
  bbsCache.set(handle, bbs);
  return bbs;
}

async function _resolveBBS(handle: string): Promise<BBS> {
  let identity: MiniDoc;
  try {
    identity = await resolveIdentity(handle);
  } catch (e) {
    throw new BBSNotFoundError(`Could not resolve handle: ${handle}`);
  }
  if (!identity.pds) {
    throw new BBSNotFoundError(`No PDS for ${handle}`);
  }

  let siteRecord: ATRecord;
  try {
    siteRecord = await getRecord(identity.did, SITE, "self");
  } catch {
    throw new NoBBSError(`${handle} isn't running a BBS.`);
  }

  if (!is(siteSchema, siteRecord.value)) {
    throw new NoBBSError(`${handle} has an invalid site record.`);
  }
  const siteValue = siteRecord.value as unknown as XyzAtbbsSite.Main;
  const siteUri = makeAtUri(identity.did, SITE, "self");
  const boardUris: string[] = siteValue.boards ?? [];

  const [boardResults, newsBacklinks] = await Promise.all([
    Promise.allSettled(
      boardUris.map((uri) => {
        const parsed = parseAtUri(uri);
        return getRecord(parsed.did, parsed.collection, parsed.rkey);
      }),
    ),
    getBacklinks(siteUri, `${POST}:scope`, 50).catch(() => null),
  ]);

  const boards: Board[] = [];
  boardResults.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    if (!is(boardSchema, result.value.value)) return;
    const board = result.value.value as unknown as XyzAtbbsBoard.Main;
    const parsed = parseAtUri(boardUris[index]);
    boards.push({
      slug: parsed.rkey,
      name: board.name,
      description: board.description,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    });
  });

  // News - posts scoped to the site, only sysop's repo
  let news: NewsPost[] = [];
  if (newsBacklinks) {
    const sysopRefs = newsBacklinks.records.filter(
      (ref) => ref.did === identity.did,
    );
    const newsRecords = await getRecordsBatch(sysopRefs);
    news = newsRecords
      .filter((record) => is(postSchema, record.value))
      .filter((record) => {
        const value = record.value as unknown as XyzAtbbsPost.Main;
        return value.title && !value.root; // root posts with titles are news/threads
      })
      .map((record) => {
        const value = record.value as unknown as XyzAtbbsPost.Main;
        return {
          uri: record.uri,
          rkey: parseAtUri(record.uri).rkey,
          title: value.title ?? "",
          body: value.body,
          createdAt: value.createdAt,
          attachments: value.attachments as PostAttachment[] | undefined,
        };
      });
    news.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return {
    identity,
    site: {
      name: siteValue.name,
      description: siteValue.description,
      intro: siteValue.intro,
      boards,
      createdAt: siteValue.createdAt ?? "",
      updatedAt: siteValue.updatedAt,
    },
    news,
  };
}
