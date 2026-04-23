/** Fetch the list of news posts a sysop has published to their site. */

import { getBacklinks, getRecordsBatch } from "./atproto";
import { POST, SITE } from "./lexicon";
import { makeAtUri, parseAtUri } from "./util";
import { is } from "@atcute/lexicons/validations";
import { mainSchema as postSchema } from "../lexicons/types/xyz/atbbs/post";
import type { XyzAtbbsPost } from "../lexicons";
import type { NewsPost } from "./bbs";

export async function fetchNews(bbsDid: string): Promise<NewsPost[]> {
  const siteUri = makeAtUri(bbsDid, SITE, "self");
  const backlinks = await getBacklinks(siteUri, `${POST}:scope`, 50).catch(
    () => null,
  );
  if (!backlinks) return [];

  const sysopRefs = backlinks.records.filter((ref) => ref.did === bbsDid);
  const records = await getRecordsBatch(sysopRefs);

  const news: NewsPost[] = records
    .filter((record) => is(postSchema, record.value))
    .filter((record) => {
      const value = record.value as unknown as XyzAtbbsPost.Main;
      return value.title && !value.root;
    })
    .map((record) => {
      const value = record.value as unknown as XyzAtbbsPost.Main;
      return {
        uri: record.uri,
        rkey: parseAtUri(record.uri).rkey,
        title: value.title ?? "",
        body: value.body,
        createdAt: value.createdAt,
        attachments: value.attachments as NewsPost["attachments"],
      };
    });

  news.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return news;
}
