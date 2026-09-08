import type { XyzAtbbsPost } from "../../lexicons";
import { parseAtUri } from "../../atproto/uri";
import {
  createRecord,
  deleteRecord,
  type AuthenticatedRepo,
} from "../../atproto/repository";
import { POST } from "../../config";
import { nowIso } from "../support/time";
import {
  prepareAttachmentViews,
  uploadAttachments,
  type AttachmentView,
  type PendingAttachment,
} from "./attachments";

type PostValue = Omit<XyzAtbbsPost.Main, "$type">;

export interface CreatedPost {
  uri: string;
  did: string;
  rkey: string;
  createdAt: string;
  attachments: AttachmentView[];
}

export async function createPost(
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

export async function deletePost(
  repo: AuthenticatedRepo,
  rkey: string,
): Promise<void> {
  await deleteRecord(repo, POST, rkey);
}
