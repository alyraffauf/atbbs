/** Fetch the list of news posts a sysop has published to their site. */

import { getBacklinks } from "../../../atproto/backlinks";
import { getRecordsBatch } from "../../../atbbs/support/records";
import { POST, SITE } from "../../../atbbs/schema/collections";
import { makeAtUri, parseAtUri } from "../../../atproto/uri";
import type { Did } from "@atcute/lexicons/syntax";
import { isPostRecord } from "../../../shared/protocol/recordGuards";
import type { NewsPost } from "../../community/data/bbs";

export async function fetchNews(bbsDid: string): Promise<NewsPost[]> {
  const siteUri = makeAtUri(bbsDid as Did, SITE, "self");
  const backlinks = await getBacklinks(
    siteUri,
    `${POST}:scope`,
    50,
    undefined,
    bbsDid,
  );

  const records = await getRecordsBatch(backlinks.records);

  const news: NewsPost[] = records
    .filter(isPostRecord)
    .filter((record) => record.value.title && !record.value.root)
    .map((record) => ({
      uri: record.uri,
      rkey: parseAtUri(record.uri).rkey,
      title: record.value.title ?? "",
      body: record.value.body,
      createdAt: record.value.createdAt,
      attachments: record.value.attachments as NewsPost["attachments"],
    }));

  news.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return news;
}
