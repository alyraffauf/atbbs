import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Did } from "@atcute/lexicons/syntax";
import type { PostDraft } from "./components/PostComposer";
import { alertOnError } from "../../frontend/app/browser/alerts";
import { useAuth } from "../auth/auth";
import type { BBS, NewsPost } from "../community/data/bbs";
import { POST, SITE } from "../../atbbs/schema/collections";
import { newsQuery } from "./data/discussionQueries";
import { queryClient } from "../../app/queryClient";
import { bbsUrl } from "../../frontend/app/router/urls";
import { nowIso } from "../../atbbs/support/time";
import { makeAtUri, parseAtUri } from "../../atproto/uri";
import { createPost } from "./data/discussionRecords";
import { deleteRecord } from "../../atproto/repository";
import { uploadAttachments } from "../../atbbs/discussion/attachments";
import { pendingAttachmentsFromFiles } from "../../frontend/features/discussion/browser/pendingAttachment";

export function usePostNews(bbs: BBS) {
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
      const item: NewsPost = {
        uri: record.uri,
        rkey: parseAtUri(record.uri).rkey,
        title: input.title ?? "",
        body: input.body,
        createdAt: nowIso(),
        attachments: attachments.length
          ? (attachments as NewsPost["attachments"])
          : undefined,
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
