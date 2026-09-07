import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Did } from "@atcute/lexicons/syntax";
import type { PostDraft } from "./components/PostComposer";
import { alertOnError } from "../../frontend/app/browser/alerts";
import { useAuth } from "../auth/auth";
import type { Community } from "../../atbbs/community/read";
import type { NewsPost } from "../../atbbs/discussion/news";
import { prepareAttachmentViews } from "../../atbbs/discussion/attachments";
import { POST, SITE } from "../../atbbs/schema/collections";
import { newsQuery } from "../../frontend/features/discussion/queries";
import { queryClient } from "../../frontend/app/queryClient";
import { bbsUrl } from "../../frontend/app/router/urls";
import { nowIso } from "../../atbbs/support/time";
import { makeAtUri, parseAtUri } from "../../atproto/uri";
import { createPost } from "./data/discussionRecords";
import { deleteRecord } from "../../atproto/repository";
import { uploadAttachments } from "../../atbbs/discussion/attachments";
import { pendingAttachmentsFromFiles } from "../../frontend/features/discussion/browser/pendingAttachment";

export function usePostNews(bbs: Community) {
  const { repo } = useAuth();
  return useMutation({
    mutationFn: async (input: PostDraft) => {
      if (!repo) throw new Error("Not signed in");
      const siteUri = makeAtUri(bbs.identity.did as Did, SITE, "self");
      const attachments = await uploadAttachments(
        repo,
        pendingAttachmentsFromFiles(input.files),
      );
      const record = await createPost(repo, siteUri, input.body, {
        title: input.title ?? "",
        attachments,
      });
      return { record, attachments };
    },
    onSuccess: ({ record, attachments }, input) => {
      const attachmentViews = prepareAttachmentViews(
        attachments,
        bbs.identity.did,
        bbs.identity.pds ?? "",
      );
      const item: NewsPost = {
        uri: record.uri,
        rkey: parseAtUri(record.uri).rkey,
        authorDid: bbs.identity.did,
        title: input.title ?? "",
        body: input.body,
        createdAt: nowIso(),
        attachments: attachmentViews.length ? attachmentViews : undefined,
      };
      queryClient.setQueryData<NewsPost[]>(
        newsQuery(bbs.identity.did).queryKey,
        (previous) => [item, ...(previous ?? [])],
      );
    },
    onError: alertOnError("post"),
  });
}

export function useDeleteNews(handle: string, rkey: string) {
  const { repo } = useAuth();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      if (!repo) throw new Error("Not signed in");
      await deleteRecord(repo, POST, rkey);
    },
    onSuccess: () => navigate(bbsUrl(handle)),
    onError: alertOnError("delete"),
  });
}
