import type { XyzAtbbsPost } from "../../../lexicons";
import { POST } from "../../../shared/config/lexicon";
import { nowIso } from "../../../shared/config/util";
import { createRecord, type AuthenticatedRepo } from "../../../shared/protocol/repository";

type Attachment = Omit<XyzAtbbsPost.Attachment, "$type">;
type PostValue = Omit<XyzAtbbsPost.Main, "$type">;

export async function createPost(
  repo: AuthenticatedRepo,
  scope: string,
  body: string,
  options?: {
    title?: string;
    root?: string;
    parent?: string;
    attachments?: Attachment[];
  },
) {
  const value: PostValue = {
    scope: scope as PostValue["scope"],
    body,
    createdAt: nowIso(),
    ...(options?.title ? { title: options.title } : {}),
    ...(options?.root ? { root: options.root as PostValue["root"] } : {}),
    ...(options?.parent
      ? { parent: options.parent as PostValue["parent"] }
      : {}),
    ...(options?.attachments?.length
      ? { attachments: options.attachments }
      : {}),
  };
  return createRecord(repo, POST, value);
}
