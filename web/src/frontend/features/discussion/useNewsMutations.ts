import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { PostDraft } from "./components/PostComposer";
import { alertOnError } from "../../app/browser/alerts";
import { useAuth } from "../auth/auth";
import type { Community } from "../../../atbbs/community/read";
import type { NewsPost } from "../../../atbbs/discussion/news";
import { newsQuery } from "../../features/discussion/queries";
import { queryClient } from "../../app/queryClient";
import { bbsUrl } from "../../app/router/urls";
import { pendingAttachmentsFromFiles } from "../../features/discussion/browser/pendingAttachment";

export function usePostNews(bbs: Community) {
  const { writer } = useAuth();
  return useMutation({
    mutationFn: async (input: PostDraft) => {
      if (!writer) throw new Error("Not signed in");
      return writer.createNews({
        communityDid: bbs.identity.did,
        title: input.title ?? "",
        body: input.body,
        attachments: pendingAttachmentsFromFiles(input.files),
      });
    },
    onSuccess: (record, input) => {
      const item: NewsPost = {
        uri: record.uri,
        rkey: record.rkey,
        authorDid: bbs.identity.did,
        title: input.title ?? "",
        body: input.body,
        createdAt: record.createdAt,
        attachments: record.attachments.length
          ? record.attachments
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
  const { writer } = useAuth();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      if (!writer) throw new Error("Not signed in");
      await writer.deletePost(rkey);
    },
    onSuccess: () => navigate(bbsUrl(handle)),
    onError: alertOnError("delete"),
  });
}
