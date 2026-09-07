import {
  useMutation,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Did } from "@atcute/lexicons/syntax";
import { useAuth } from "../features/auth/auth";
import type { BBS, Board } from "../features/community/data/bbs";
import type { ThreadItem, ThreadPageResult } from "../lib/boardThreads";
import { BOARD } from "../shared/config/lexicon";
import { myThreadsQuery } from "../lib/queries/dashboard";
import { boardThreadsInfiniteQuery } from "../lib/queries/discussion";
import { queryClient } from "../app/queryClient";
import { threadUrl } from "../shared/config/routes";
import { nowIso } from "../shared/config/util";
import { makeAtUri, parseAtUri } from "../shared/protocol/uri";
import { createPost } from "../lib/discussionRecords";
import { uploadAttachments } from "../shared/protocol/repository";
import { alertOnError } from "../shared/config/alerts";
import type { PostDraft } from "../components/form/ComposeForm";

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

export function useBoardPosting(bbs: BBS, board: Board, handle: string) {
  const { user, repo } = useAuth();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: PostDraft) => {
      if (!repo) throw new Error("Not signed in");
      const boardUri = makeAtUri(bbs.identity.did as Did, BOARD, board.slug);
      const attachments = await uploadAttachments(repo, input.files);
      return createPost(repo, boardUri, input.body, {
        title: input.title ?? "",
        attachments,
      });
    },
    onSuccess: (record, input) => {
      if (!user) return;
      const { did, rkey } = parseAtUri(record.uri);
      const now = nowIso();
      const newThread: ThreadItem = {
        uri: record.uri,
        did,
        rkey,
        handle: user.handle,
        title: input.title ?? "",
        body: input.body,
        createdAt: now,
        lastActivityAt: now,
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
