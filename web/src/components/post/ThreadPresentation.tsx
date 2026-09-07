import type { BBSModeration } from "../../features/moderation/data/bbsModeration";
import type { Reply } from "../../lib/replies";
import type { ThreadRoot } from "../../lib/thread";
import type { ReactNode } from "react";
import PageNav from "../../shared/ui/PageNav";
import ThreadCard from "./ThreadCard";
import ThreadReplyList from "./ThreadReplyList";

interface ThreadPresentationProps {
  thread: ThreadRoot;
  replies: Reply[];
  parentReplies: Record<string, Reply>;
  moderation: BBSModeration;
  moderationIsStale: boolean;
  userDid?: string;
  sysopDid: string;
  page: number;
  totalPages: number;
  truncated: boolean;
  onPageChange: (page: number) => void;
  onReplyTo: (reply: Reply) => void;
  onParentClick: (uri: string) => void;
  onDeleteThread: () => void;
  onDeleteReply: (reply: Reply) => void;
  onBan: (did: string) => void;
  onUnban: (rkey: string) => void;
  onHide: (uri: string) => void;
  onUnhide: (rkey: string) => void;
  children?: ReactNode;
}

export default function ThreadPresentation(props: ThreadPresentationProps) {
  const {
    thread,
    replies,
    parentReplies,
    moderation,
    moderationIsStale,
    userDid,
    sysopDid,
    page,
    totalPages,
    truncated,
    onPageChange,
    onReplyTo,
    onParentClick,
    onDeleteThread,
    onDeleteReply,
    onBan,
    onUnban,
    onHide,
    onUnhide,
    children,
  } = props;
  const isSysop = userDid === sysopDid;
  const threadHidden =
    !isSysop &&
    (!!moderation.banRkeys[thread.did] || !!moderation.hideRkeys[thread.uri]);

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
        userDid={userDid}
        sysopDid={sysopDid}
        banRkey={moderation.banRkeys[thread.did]?.[0] ?? null}
        hideRkey={moderation.hideRkeys[thread.uri]?.[0] ?? null}
        onDelete={onDeleteThread}
        onBan={() => onBan(thread.did)}
        onUnban={onUnban}
        onHide={() => onHide(thread.uri)}
        onUnhide={onUnhide}
      />

      {totalPages > 1 && (
        <PageNav current={page} total={totalPages} onGo={onPageChange} />
      )}
      {truncated && (
        <p className="text-xs text-neutral-500 mt-2">
          Showing the latest 2,000 replies.
        </p>
      )}
      <div className="space-y-2 mt-4">
        <ThreadReplyList
          replies={replies}
          parentReplies={parentReplies}
          moderation={moderation}
          userDid={userDid}
          sysopDid={sysopDid}
          onReplyTo={onReplyTo}
          onParentClick={onParentClick}
          onDelete={onDeleteReply}
          onBan={onBan}
          onUnban={onUnban}
          onHide={onHide}
          onUnhide={onUnhide}
        />
      </div>
      {totalPages > 1 && (
        <div className="mt-6">
          <PageNav current={page} total={totalPages} onGo={onPageChange} />
        </div>
      )}
      {children}
    </>
  );
}
