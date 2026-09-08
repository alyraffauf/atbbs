/** Fetch the list of news posts a sysop has published to their site. */

import {
  getBacklinks,
  makeAtUri,
  parseAtUri,
  resolveIdentity,
  type AuthenticatedRepo,
} from "@atbbs/atproto";
import { getRecordsBatch } from "../support/records";
import { POST, SITE } from "../config";
import type { Did } from "@atcute/lexicons/syntax";
import { isPostRecord } from "../schema/records";
import { prepareAttachmentViews, type AttachmentView } from "./attachments";
import type { PendingAttachment } from "./attachments";
import { createPost } from "./posts";

export interface CreateNewsInput {
  communityDid: string;
  title: string;
  body: string;
  attachments: PendingAttachment[];
}

export function createNews(
  repo: AuthenticatedRepo,
  pdsUrl: string,
  input: CreateNewsInput,
) {
  return createPost(repo, pdsUrl, {
    scope: makeAtUri(input.communityDid as Did, SITE, "self"),
    title: input.title,
    body: input.body,
    attachments: input.attachments,
  });
}

export interface NewsPost {
  uri: string;
  rkey: string;
  title: string;
  body: string;
  createdAt: string;
  attachments?: AttachmentView[];
}

export async function fetchNews(bbsDid: string): Promise<NewsPost[]> {
  const identity = await resolveIdentity(bbsDid);
  const siteUri = makeAtUri(bbsDid as Did, SITE, "self");
  const backlinks = await getBacklinks(siteUri, `${POST}:scope`, {
    limit: 50,
    did: bbsDid,
  });

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
      attachments: prepareAttachmentViews(
        record.value.attachments,
        bbsDid,
        identity.pds ?? "",
      ),
    }));

  news.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return news;
}
