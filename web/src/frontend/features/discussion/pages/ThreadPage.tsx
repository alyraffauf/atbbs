import { useState } from "react";
import { useLoaderData } from "react-router-dom";
import { useSuspenseQuery } from "@tanstack/react-query";
import PostComposer from "../components/PostComposer";
import ThreadPresentation from "../components/ThreadPresentation";
import { useAuth } from "../../auth/auth";
import * as limits from "../../../../atbbs/schema/limits";
import { bbsModerationQuery } from "../../../features/moderation/queries";
import type { Reply } from "../../../../atbbs/discussion/replies";
import { useModerationMutations } from "../../moderation/useModerationMutations";
import { usePageTitle } from "../../../app/browser/usePageTitle";
import { useThreadMutations } from "../useThreadMutations";
import { useThreadReplies } from "../useThreadReplies";
import type { ThreadLoaderData } from "../../../app/router/loaders/content";

export default function ThreadPage() {
  const { handle, bbs, thread } = useLoaderData() as ThreadLoaderData;
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
  } = useThreadReplies(thread.uri);
  const [replyingTo, setReplyingTo] = useState<{
    uri: string;
    handle: string;
    replyRkey: string;
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

  function onDeleteThread() {
    if (confirm("Delete this thread?")) deleteThread.mutate();
  }

  function onDeleteReply(reply: Reply) {
    if (confirm("Delete this reply?")) deleteReply.mutate(reply);
  }

  function onBan(did: string) {
    if (confirm("Ban this user from your community?")) ban.mutate(did);
  }

  function onUnban(rkey: string) {
    if (!confirm("Unban this user?")) return;
    const rkeys = Object.values(moderation.banRkeys).find((items) =>
      items.includes(rkey),
    );
    if (rkeys) unban.mutate(rkeys);
  }

  function onHide(uri: string) {
    if (confirm("Hide this post?")) hide.mutate(uri);
  }

  function onUnhide(rkey: string) {
    if (!confirm("Unhide this post?")) return;
    const rkeys = Object.values(moderation.hideRkeys).find((items) =>
      items.includes(rkey),
    );
    if (rkeys) unhide.mutate(rkeys);
  }

  return (
    <>
      <ThreadPresentation
        thread={thread}
        replies={replies}
        parentReplies={parentReplies}
        moderation={moderation}
        moderationIsStale={moderationIsStale}
        userDid={user?.did}
        sysopDid={bbs.identity.did}
        page={page}
        totalPages={totalPages}
        truncated={truncated}
        onPageChange={setPage}
        onReplyTo={(reply) =>
          setReplyingTo({
            uri: reply.uri,
            handle: reply.handle,
            replyRkey: reply.rkey,
          })
        }
        onParentClick={scrollToReply}
        onDeleteThread={onDeleteThread}
        onDeleteReply={onDeleteReply}
        onBan={onBan}
        onUnban={onUnban}
        onHide={onHide}
        onUnhide={onUnhide}
      >
        {user && (
          <PostComposer
            className="mt-6 border border-neutral-800 rounded p-4"
            onSave={(draft) =>
              createReply.mutateAsync({
                ...draft,
                parent: replyingTo?.uri ?? null,
                parentRkey: replyingTo?.replyRkey ?? null,
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
      </ThreadPresentation>
    </>
  );
}
