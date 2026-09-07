import { PenLine } from "lucide-react";
import { useLoaderData } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/auth";
import { usePageTitle } from "../../../app/browser/usePageTitle";
import { relativeDate } from "../../../ui/dates";
import * as limits from "../../../../atbbs/schema/limits";
import { bbsModerationQuery } from "../../../features/moderation/queries";
import { boardThreadsInfiniteQuery } from "../../../features/discussion/queries";
import { getPostModeration } from "../../../../atbbs/moderation/policy";
import { threadUrl } from "../../../app/router/urls";
import ThreadListItem, { ThreadListHeader } from "../components/ThreadListItem";
import PostComposer from "../components/PostComposer";
import ListSkeleton from "../../../app/layout/ListSkeleton";
import type { BoardLoaderData } from "../../../app/router/loaders";
import { useBoardPosting } from "../useBoardPosting";

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
          (thread) =>
            getPostModeration(
              moderation,
              thread,
              user?.did,
              bbs.identity.did,
            ).isVisible,
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
          <PostComposer
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
              <ThreadListItem
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
