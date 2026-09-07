import type { XyzAtbbsPost } from "../../lexicons";
import { makeAtUri, parseAtUri } from "../../atproto/uri";
import {
  createRecord,
  deleteRecord,
  type AuthenticatedRepo,
} from "../../atproto/repository";
import { BOARD, POST, SITE } from "../../config";
import { nowIso } from "../support/time";
import {
  prepareAttachmentViews,
  uploadAttachments,
  type AttachmentView,
  type PendingAttachment,
} from "./attachments";

type PostValue = Omit<XyzAtbbsPost.Main, "$type">;

export interface CreateThreadInput {
  communityDid: string;
  boardSlug: string;
  title: string;
  body: string;
  attachments: PendingAttachment[];
}

export interface CreateReplyInput {
  communityDid: string;
  boardSlug: string;
  threadUri: string;
  parent?: string;
  body: string;
  attachments: PendingAttachment[];
}

export interface CreateNewsInput {
  communityDid: string;
  title: string;
  body: string;
  attachments: PendingAttachment[];
}

export interface CreatedPost {
  uri: string;
  did: string;
  rkey: string;
  createdAt: string;
  attachments: AttachmentView[];
}

async function createPost(
  repo: AuthenticatedRepo,
  pdsUrl: string,
  input: {
    scope: string;
    title?: string;
    body: string;
    root?: string;
    parent?: string;
    attachments: PendingAttachment[];
  },
): Promise<CreatedPost> {
  const createdAt = nowIso();
  const attachments = await uploadAttachments(repo, input.attachments);
  const value: PostValue = {
    scope: input.scope as PostValue["scope"],
    body: input.body,
    createdAt,
    ...(input.title ? { title: input.title } : {}),
    ...(input.root ? { root: input.root as PostValue["root"] } : {}),
    ...(input.parent ? { parent: input.parent as PostValue["parent"] } : {}),
    ...(attachments.length ? { attachments } : {}),
  };
  const record = await createRecord(repo, POST, value);
  const { did, rkey } = parseAtUri(record.uri);
  return {
    uri: record.uri,
    did,
    rkey,
    createdAt,
    attachments: prepareAttachmentViews(attachments, did, pdsUrl),
  };
}

export function createThread(
  repo: AuthenticatedRepo,
  pdsUrl: string,
  input: CreateThreadInput,
) {
  return createPost(repo, pdsUrl, {
    scope: makeAtUri(
      input.communityDid as `did:${string}:${string}`,
      BOARD,
      input.boardSlug,
    ),
    title: input.title,
    body: input.body,
    attachments: input.attachments,
  });
}

export function createReply(
  repo: AuthenticatedRepo,
  pdsUrl: string,
  input: CreateReplyInput,
) {
  return createPost(repo, pdsUrl, {
    scope: makeAtUri(
      input.communityDid as `did:${string}:${string}`,
      BOARD,
      input.boardSlug,
    ),
    body: input.body,
    root: input.threadUri,
    parent: input.parent,
    attachments: input.attachments,
  });
}

export function createNews(
  repo: AuthenticatedRepo,
  pdsUrl: string,
  input: CreateNewsInput,
) {
  return createPost(repo, pdsUrl, {
    scope: makeAtUri(
      input.communityDid as `did:${string}:${string}`,
      SITE,
      "self",
    ),
    title: input.title,
    body: input.body,
    attachments: input.attachments,
  });
}

export function deletePost(repo: AuthenticatedRepo, rkey: string) {
  return deleteRecord(repo, POST, rkey).then(() => undefined);
}
