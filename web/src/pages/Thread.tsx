import { useState } from "react";
import { useLoaderData } from "react-router-dom";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { usePageTitle } from "../hooks/usePageTitle";
import { useThreadReplies } from "../hooks/useThreadReplies";
import * as limits from "../lib/limits";
import { useModerationMutations } from "../hooks/useModerationMutations";
import { bbsModerationQuery } from "../lib/queries";
import PageNav from "../components/nav/PageNav";
import ReplyCard from "../components/post/ReplyCard";
import type { Reply } from "../lib/replies";
import ComposeForm from "../components/form/ComposeForm";
import ThreadCard from "../components/post/ThreadCard";
import type { ThreadLoaderData } from "../router/loaders";
import { useThreadMutations } from "../hooks/useThreadMutations";

export default function ThreadPage() {
  const { handle, bbs, thread } = useLoaderData() as ThreadLoaderData;
  const threadUri = thread.uri;
  const { user } = useAuth();

  const { data: moderation, isError: moderationIsStale } = useSuspenseQuery(
    bbsModerationQuery(bbs.identity.pds ?? "", bbs.identity.did),
  );
  const {
    page,
    setPage,
    totalPages,
    replies,
    parentReplies,
    truncated,
    scrollToReply,
  } = useThreadReplies(threadUri);

  const isSysop = !!(user && user.did === bbs.identity.did);
  const threadHidden =
    !isSysop &&
    (!!moderation.banRkeys[thread.did] || !!moderation.hideRkeys[thread.uri]);
  const visibleReplies = isSysop
    ? replies
    : replies.filter(
        (reply) =>
          !moderation.banRkeys[reply.did] && !moderation.hideRkeys[reply.uri],
      );

  const [replyingTo, setReplyingTo] = useState<{
    uri: string;
    handle: string;
  } | null>(null);

  usePageTitle(`${thread.title} — ${bbs.site.name}`);

  const { createReply, deleteReply, deleteThread } = useThreadMutations({
    bbs,
    thread,
    handle,
    page,
    setPage,
    onReplyCreated: () => setReplyingTo(null),
  });

  const { ban, unban, hide, unhide } = useModerationMutations();

  // --- Handlers ---

  function onDeleteThread() {
    if (!confirm("Delete this thread?")) return;
    deleteThread.mutate();
  }

  function onDeleteReply(reply: Reply) {
    if (!confirm("Delete this reply?")) return;
    deleteReply.mutate(reply);
  }

  function onBan(banDid: string) {
    if (!confirm("Ban this user from your community?")) return;
    ban.mutate(banDid);
  }

  function onUnban(rkey: string) {
    if (!confirm("Unban this user?")) return;
    const rkeys = Object.values(moderation.banRkeys).find((items) =>
      items.includes(rkey),
    );
    if (rkeys) unban.mutate(rkeys);
  }

  function onHide(uri: string) {
    if (!confirm("Hide this post?")) return;
    hide.mutate(uri);
  }

  function onUnhide(rkey: string) {
    if (!confirm("Unhide this post?")) return;
    const rkeys = Object.values(moderation.hideRkeys).find((items) =>
      items.includes(rkey),
    );
    if (rkeys) unhide.mutate(rkeys);
  }

  if (threadHidden) {
    return (
      <p className="text-neutral-400 py-16 text-center">
        This thread has been hidden by the sysop.
      </p>
    );
  }

  return (
    <>
      {moderationIsStale && (
        <p className="text-xs text-amber-500 mb-3">
          Moderation data could not be refreshed. Showing verified cached data.
        </p>
      )}
      <ThreadCard
        thread={thread}
        userDid={user?.did}
        sysopDid={bbs.identity.did}
        banRkey={moderation.banRkeys[thread.did]?.[0] ?? null}
        hideRkey={moderation.hideRkeys[thread.uri]?.[0] ?? null}
        onDelete={onDeleteThread}
        onBan={() => onBan(thread.did)}
        onUnban={onUnban}
        onHide={() => onHide(thread.uri)}
        onUnhide={onUnhide}
      />

      {totalPages > 1 && (
        <PageNav current={page} total={totalPages} onGo={setPage} />
      )}

      {truncated && (
        <p className="text-xs text-neutral-500 mt-2">
          Showing the latest 2,000 replies.
        </p>
      )}

      <div className="space-y-2 mt-4">
        {visibleReplies.length === 0 && !user ? (
          <p className="text-neutral-400">No replies yet.</p>
        ) : (
          visibleReplies.map((reply) => {
            const parentReply = reply.parent
              ? parentReplies[reply.parent]
              : null;
            const parentHidden =
              !!parentReply &&
              !isSysop &&
              (!!moderation.banRkeys[parentReply.did] ||
                !!moderation.hideRkeys[parentReply.uri]);
            return (
              <ReplyCard
                key={reply.uri}
                reply={reply}
                userDid={user?.did ?? ""}
                sysopDid={bbs.identity.did}
                parentPost={
                  parentHidden ? undefined : (parentReply ?? undefined)
                }
                banRkey={moderation.banRkeys[reply.did]?.[0] ?? null}
                hideRkey={moderation.hideRkeys[reply.uri]?.[0] ?? null}
                onReplyTo={() =>
                  setReplyingTo({ uri: reply.uri, handle: reply.handle })
                }
                onParentClick={
                  reply.parent ? () => scrollToReply(reply.parent!) : undefined
                }
                onDelete={() => onDeleteReply(reply)}
                onBan={() => onBan(reply.did)}
                onUnban={onUnban}
                onHide={() => onHide(reply.uri)}
                onUnhide={onUnhide}
              />
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6">
          <PageNav current={page} total={totalPages} onGo={setPage} />
        </div>
      )}

      {user && (
        <ComposeForm
          className="mt-6 border border-neutral-800 rounded p-4"
          onSave={(draft) =>
            createReply.mutateAsync({
              ...draft,
              parent: replyingTo?.uri ?? null,
            })
          }
          bodyPlaceholder="Write a reply..."
          bodyRows={3}
          bodyMaxLength={limits.POST_BODY}
          replyingTo={replyingTo}
          onClearReplyTo={() => setReplyingTo(null)}
          submitLabel="reply"
        />
      )}
    </>
  );
}
