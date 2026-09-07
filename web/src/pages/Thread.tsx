import { useState, type SyntheticEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useBreadcrumb } from "../hooks/useBreadcrumb";
import { usePageTitle } from "../hooks/usePageTitle";
import { useThreadReplies } from "../hooks/useThreadReplies";
import { BOARD, POST } from "../lib/lexicon";
import { makeAtUri, nowIso, parseAtUri } from "../lib/util";
import type { Did } from "@atcute/lexicons/syntax";
import * as limits from "../lib/limits";
import {
  createPost,
  deleteRecord,
  uploadAttachments,
} from "../lib/writes";
import { useModerationMutations } from "../hooks/useModerationMutations";
import {
  bbsModerationQuery,
  bbsQuery,
  myThreadsQuery,
  threadRootQuery,
} from "../lib/queries";
import { queryClient } from "../lib/queryClient";
import { bbsUrl, boardUrl } from "../lib/routes";
import { REPLIES_PER_PAGE } from "../lib/replies";
import {
  appendRefAndReply,
  cancelRefsRefetch,
  getRefs,
  removeRefAndReply,
  setRefs,
} from "../lib/threadCache";
import { alertOnError } from "../lib/alerts";
import type { BacklinkRef } from "../lib/atproto";
import type { BBS } from "../lib/bbs";
import PageNav from "../components/nav/PageNav";
import ReplyCard from "../components/post/ReplyCard";
import type { Reply } from "../lib/replies";
import ComposeForm from "../components/form/ComposeForm";
import ThreadCard from "../components/post/ThreadCard";

export default function ThreadPage() {
  const { handle, did, tid } = useParams();
  const threadUri = makeAtUri(did! as Did, POST, tid!);
  const { user, repo } = useAuth();
  const navigate = useNavigate();

  const { data: bbs } = useSuspenseQuery(bbsQuery(handle!));
  const { data: thread } = useSuspenseQuery(
    threadRootQuery(bbs.identity.did, did!, tid!),
  );
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
    (!!moderation.banRkeys[thread.did] ||
      !!moderation.hideRkeys[thread.uri]);
  const visibleReplies = isSysop
    ? replies
    : replies.filter(
        (reply) =>
          !moderation.banRkeys[reply.did] &&
          !moderation.hideRkeys[reply.uri],
      );

  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<{
    uri: string;
    handle: string;
  } | null>(null);

  usePageTitle(`${thread.title} — ${bbs.site.name}`);
  useBreadcrumb(buildBreadcrumb(bbs, thread.title, thread.boardSlug, handle!), [
    bbs,
    thread,
    handle,
  ]);

  // --- Mutations ---

  const createReplyMutation = useMutation({
    mutationFn: async (input: {
      body: string;
      parent: string | null;
      files: File[];
    }) => {
      if (!repo || !user) throw new Error("Not signed in");
      const boardUri = makeAtUri(
        bbs.identity.did as Did,
        BOARD,
        thread.boardSlug,
      );
      const attachments = await uploadAttachments(repo, input.files);
      const record = await createPost(repo, boardUri, input.body, {
        root: threadUri,
        parent: input.parent ?? undefined,
        attachments,
      });
      return { record, input, attachments };
    },
    onSuccess: ({ record, input, attachments }) => {
      if (!user) return;
      const { did: newDid, rkey: newRkey } = parseAtUri(record.uri);
      const newRef: BacklinkRef = {
        did: newDid,
        collection: POST,
        rkey: newRkey,
      };
      const newReply: Reply = {
        uri: record.uri,
        did: newDid,
        rkey: newRkey,
        handle: user.handle,
        pds: user.pdsUrl,
        body: input.body,
        createdAt: nowIso(),
        parent: input.parent,
        attachments: attachments as Reply["attachments"],
      };

      const updatedRefs = appendRefAndReply(threadUri, newRef, newReply);

      setBody("");
      setFiles([]);
      setReplyingTo(null);

      const newLastPage = Math.max(
        1,
        Math.ceil(updatedRefs.length / REPLIES_PER_PAGE),
      );
      if (page !== newLastPage) setPage(newLastPage);
    },
    onError: alertOnError("post reply"),
  });

  const deleteReplyMutation = useMutation({
    mutationFn: async (reply: Reply) => {
      if (!repo) throw new Error("Not signed in");
      await deleteRecord(repo, POST, reply.rkey);
      return reply;
    },
    onMutate: async (reply) => {
      await cancelRefsRefetch(threadUri);
      const previousRefs = getRefs(threadUri);
      removeRefAndReply(threadUri, reply.uri);
      return { previousRefs };
    },
    onError: (err, _reply, context) => {
      if (context) setRefs(threadUri, context.previousRefs);
      alertOnError("delete")(err);
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async () => {
      if (!repo) throw new Error("Not signed in");
      await deleteRecord(repo, POST, thread.rkey);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries(myThreadsQuery(user.pdsUrl, user.did));
      }
      navigate(bbsUrl(handle!));
    },
    onError: alertOnError("delete"),
  });

  const { ban, unban, hide, unhide } = useModerationMutations();

  // --- Handlers ---

  function onReply(event: SyntheticEvent) {
    event.preventDefault();
    if (createReplyMutation.isPending) return;
    createReplyMutation.mutate({
      body: body.trim(),
      parent: replyingTo?.uri ?? null,
      files,
    });
  }

  function onDeleteThread() {
    if (!confirm("Delete this thread?")) return;
    deleteThreadMutation.mutate();
  }

  function onDeleteReply(reply: Reply) {
    if (!confirm("Delete this reply?")) return;
    deleteReplyMutation.mutate(reply);
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
          onSubmit={onReply}
          body={body}
          onBodyChange={setBody}
          bodyPlaceholder="Write a reply..."
          bodyRows={3}
          bodyMaxLength={limits.POST_BODY}
          files={files}
          onFilesChange={setFiles}
          replyingTo={replyingTo}
          onClearReplyTo={() => setReplyingTo(null)}
          submitLabel="reply"
          posting={createReplyMutation.isPending}
        />
      )}
    </>
  );
}

function buildBreadcrumb(
  bbs: BBS,
  threadTitle: string,
  boardSlug: string,
  handle: string,
) {
  const board = bbs.site.boards.find((b) => b.slug === boardSlug);
  return [
    { label: bbs.site.name, to: bbsUrl(handle) },
    ...(board ? [{ label: board.name, to: boardUrl(handle, board.slug) }] : []),
    { label: threadTitle },
  ];
}
