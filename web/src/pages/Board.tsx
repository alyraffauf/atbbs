import { useState, type SyntheticEvent } from "react";
import { PenLine } from "lucide-react";
import { useLoaderData, useNavigate } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { usePageTitle } from "../hooks/usePageTitle";
import { makeAtUri, nowIso, parseAtUri, relativeDate } from "../lib/util";
import type { Did } from "@atcute/lexicons/syntax";
import { BOARD } from "../lib/lexicon";
import { createPost, uploadAttachments } from "../lib/writes";
import * as limits from "../lib/limits";
import {
  bbsModerationQuery,
  boardThreadsInfiniteQuery,
  myThreadsQuery,
} from "../lib/queries";
import { queryClient } from "../lib/queryClient";
import { threadUrl } from "../lib/routes";
import { alertOnError } from "../lib/alerts";
import type { ThreadItem, ThreadPageResult } from "../lib/boardThreads";
import ThreadLink, { ThreadListHeader } from "../components/nav/ThreadLink";
import ComposeForm from "../components/form/ComposeForm";
import ListSkeleton from "../components/layout/ListSkeleton";
import type { BoardLoaderData } from "../router/loaders";

// Constellation indexes PDS writes asynchronously — usually within a second,
// occasionally longer. After creating a thread we refetch with backoff until
// the board's server data includes the new URI, so the optimistic prepend is
// replaced by authoritative data rather than being wiped by a premature
// refetch-on-mount returning stale results.
async function refetchUntilIndexed(boardKey: QueryKey, threadUri: string) {
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
    if (data?.pages.some((p) => p.threads.some((t) => t.uri === threadUri))) {
      return;
    }
  }
}

export default function BoardPage() {
  const { handle, bbs, board } = useLoaderData() as BoardLoaderData;
  const { user, repo } = useAuth();
  const navigate = useNavigate();

  const {
    data: threadPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(boardThreadsInfiniteQuery(bbs.identity.did, board.slug));
  const { data: moderation, isError: moderationIsStale } = useQuery(
    bbsModerationQuery(bbs.identity.pds ?? "", bbs.identity.did),
  );
  const isSysop = !!(user && user.did === bbs.identity.did);
  const ready = !!threadPages && !!moderation;
  const allThreads = threadPages?.pages.flatMap((page) => page.threads) ?? [];
  const threads =
    isSysop || !moderation
      ? allThreads
      : allThreads.filter(
          (t) =>
            !moderation.banRkeys[t.did] && !moderation.hideRkeys[t.uri],
        );

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  usePageTitle(`${board.name} — ${bbs.site.name}`);

  const createThreadMutation = useMutation({
    mutationFn: async (input: {
      title: string;
      body: string;
      files: File[];
    }) => {
      if (!repo) throw new Error("Not signed in");
      const boardUri = makeAtUri(bbs.identity.did as Did, BOARD, board.slug);
      const attachments = await uploadAttachments(repo, input.files);
      const record = await createPost(repo, boardUri, input.body, {
        title: input.title,
        attachments,
      });
      return record;
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
        title: input.title,
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
        (prev) => {
          if (!prev || !prev.pages.length) return prev;
          const [firstPage, ...rest] = prev.pages;
          return {
            ...prev,
            pages: [
              {
                ...firstPage,
                threads: [newThread, ...firstPage.threads],
              },
              ...rest,
            ],
          };
        },
      );
      void refetchUntilIndexed(boardKey, record.uri);
      queryClient.invalidateQueries(myThreadsQuery(user.pdsUrl, user.did));
      setTitle("");
      setBody("");
      setFiles([]);
      navigate(threadUrl(handle, did, rkey));
    },
    onError: alertOnError("post"),
  });

  function onCreate(event: SyntheticEvent) {
    event.preventDefault();
    if (createThreadMutation.isPending) return;
    createThreadMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      files,
    });
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-lg text-neutral-200 mb-1">{board.name}</h1>
        <p className="text-neutral-400">{board.description}</p>
      </div>

      {user && (
        <details className="mb-6 border border-neutral-800 rounded p-4">
          <summary className="text-neutral-300 cursor-pointer inline-flex items-center gap-1.5">
            <PenLine size={14} /> new thread
          </summary>
          <ComposeForm
            className="mt-4"
            onSubmit={onCreate}
            title={title}
            onTitleChange={setTitle}
            titlePlaceholder="Thread title"
            titleMaxLength={limits.POST_TITLE}
            body={body}
            onBodyChange={setBody}
            bodyMaxLength={limits.POST_BODY}
            files={files}
            onFilesChange={setFiles}
            posting={createThreadMutation.isPending}
          />
        </details>
      )}

      <div>
        {moderationIsStale && moderation && (
          <p className="text-xs text-amber-500 mb-3">
            Moderation data could not be refreshed. Showing verified cached data.
          </p>
        )}
        {!ready ? (
          <ListSkeleton />
        ) : threads.length ? (
          <>
            <ThreadListHeader />
            {threads.map((t) => (
              <ThreadLink
                key={t.uri}
                to={threadUrl(handle, t.did, t.rkey)}
                title={t.title}
                preview={t.body.substring(0, 120)}
                authorHandle={t.handle}
                participants={t.participants}
                replyCount={t.replyCount}
                activity={relativeDate(t.lastActivityAt)}
              />
            ))}
          </>
        ) : (
          <p className="text-neutral-400">No threads yet.</p>
        )}
      </div>

      {hasNextPage && (
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-neutral-400 hover:text-neutral-300"
          >
            {isFetchingNextPage ? "loading..." : "next page →"}
          </button>
        </div>
      )}
    </>
  );
}
