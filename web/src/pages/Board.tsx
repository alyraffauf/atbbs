import { PenLine } from "lucide-react";
import { useLoaderData } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuth } from "../features/auth/auth";
import { usePageTitle } from "../shared/hooks/usePageTitle";
import { relativeDate } from "../shared/config/util";
import * as limits from "../shared/config/limits";
import { bbsModerationQuery } from "../lib/queries/moderation";
import { boardThreadsInfiniteQuery } from "../lib/queries/discussion";
import { threadUrl } from "../shared/config/routes";
import ThreadLink, { ThreadListHeader } from "../components/nav/ThreadLink";
import ComposeForm from "../components/form/ComposeForm";
import ListSkeleton from "../app/layout/ListSkeleton";
import type { BoardLoaderData } from "../app/router/loaders";
import { useBoardPosting } from "../hooks/useBoardPosting";

export default function BoardPage() {
  const { handle, bbs, board } = useLoaderData() as BoardLoaderData;
  const { user } = useAuth();

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
          (t) => !moderation.banRkeys[t.did] && !moderation.hideRkeys[t.uri],
        );

  usePageTitle(`${board.name} — ${bbs.site.name}`);

  const createThread = useBoardPosting(bbs, board, handle);

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
            onSave={(draft) => createThread.mutateAsync(draft)}
            title={{
              placeholder: "Thread title",
              maxLength: limits.POST_TITLE,
            }}
            bodyMaxLength={limits.POST_BODY}
          />
        </details>
      )}

      <div>
        {moderationIsStale && moderation && (
          <p className="text-xs text-amber-500 mb-3">
            Moderation data could not be refreshed. Showing verified cached
            data.
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
