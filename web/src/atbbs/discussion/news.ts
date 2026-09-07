/** Fetch the list of news posts a sysop has published to their site. */

import { getBacklinks } from "../../atproto/backlinks";
import { getRecordsBatch } from "../support/records";
import { POST, SITE } from "../schema/collections";
import { makeAtUri, parseAtUri } from "../../atproto/uri";
import type { Did } from "@atcute/lexicons/syntax";
import { isPostRecord } from "../schema/records";
import { resolveIdentity } from "../../atproto/identity";
import { prepareAttachmentViews, type AttachmentView } from "./attachments";

export interface NewsPost {
  uri: string;
  rkey: string;
  authorDid: string;
  title: string;
  body: string;
  createdAt: string;
  attachments?: AttachmentView[];
}

export async function fetchNews(bbsDid: string): Promise<NewsPost[]> {
  const identity = await resolveIdentity(bbsDid);
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
      authorDid: bbsDid,
      title: record.value.title ?? "",
      body: record.value.body,
      createdAt: record.value.createdAt,
      attachments: prepareAttachmentViews(
        record.value.attachments,
        bbsDid,
        identity.pds ?? "",
      ),
    }));

  news.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return news;
}
