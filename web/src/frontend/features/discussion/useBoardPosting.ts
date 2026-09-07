import {
  useMutation,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth";
import type { Board, Community } from "../../../atbbs/community/read";
import type {
  ThreadSummary,
  ThreadPageResult,
} from "../../../atbbs/discussion/threads";
import { myThreadsQuery } from "../../features/dashboard/queries";
import { boardThreadsInfiniteQuery } from "../../features/discussion/queries";
import { queryClient } from "../../app/queryClient";
import { threadUrl } from "../../app/router/urls";
import { pendingAttachmentsFromFiles } from "../../features/discussion/browser/pendingAttachment";
import { alertOnError } from "../../app/browser/alerts";
import type { PostDraft } from "./components/PostComposer";

export async function waitForThreadIndexing(
  boardKey: QueryKey,
  threadUri: string,
) {
  const delays = [500, 800, 1300, 2100, 3400];
  for (const delay of delays) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await queryClient.refetchQueries({ queryKey: boardKey });
    } catch {
      continue;
    }
    const data =
      queryClient.getQueryData<InfiniteData<ThreadPageResult>>(boardKey);
    if (
      data?.pages.some((page) =>
        page.threads.some((thread) => thread.uri === threadUri),
      )
    )
      return;
  }
}

export function useBoardPosting(bbs: Community, board: Board, handle: string) {
  const { user, writer } = useAuth();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: PostDraft) => {
      if (!writer) throw new Error("Not signed in");
      return writer.createThread({
        communityDid: bbs.identity.did,
        boardSlug: board.slug,
        title: input.title ?? "",
        body: input.body,
        attachments: pendingAttachmentsFromFiles(input.files),
      });
    },
    onSuccess: (record, input) => {
      if (!user) return;
      const { did, rkey, createdAt } = record;
      const newThread: ThreadSummary = {
        uri: record.uri,
        did,
        rkey,
        handle: user.handle,
        title: input.title ?? "",
        body: input.body,
        createdAt,
        lastActivityAt: createdAt,
        replyCount: 0,
        participants: [{ did, handle: user.handle }],
      };
      const boardKey = boardThreadsInfiniteQuery(
        bbs.identity.did,
        board.slug,
      ).queryKey;
      queryClient.setQueryData<InfiniteData<ThreadPageResult>>(
        boardKey,
        (previous) => {
          if (!previous?.pages.length) return previous;
          const [firstPage, ...remainingPages] = previous.pages;
          return {
            ...previous,
            pages: [
              { ...firstPage, threads: [newThread, ...firstPage.threads] },
              ...remainingPages,
            ],
          };
        },
      );
      void waitForThreadIndexing(boardKey, record.uri);
      void queryClient.invalidateQueries(myThreadsQuery(user.pdsUrl, user.did));
      navigate(threadUrl(handle, did, rkey));
    },
    onError: alertOnError("post"),
  });
}
