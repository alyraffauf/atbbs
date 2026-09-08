import {
  getPostModeration,
  type ModerationState,
} from "@atbbs/core/moderation";
import type { Reply, Thread } from "@atbbs/core/discussion";
import type { ReactNode } from "react";
import ReplyPagination from "./ReplyPagination";
import ThreadPostCard from "./ThreadPostCard";
import ThreadReplyList from "./ThreadReplyList";

interface ThreadPresentationProps {
  thread: Thread;
  replies: Reply[];
  parentReplies: Record<string, Reply>;
  moderation: ModerationState;
  moderationIsStale: boolean;
  userDid?: string;
  sysopDid: string;
  page: number;
  totalPages: number;
  truncated: boolean;
  onPageChange: (page: number) => void;
  onReplyTo: (reply: Reply) => void;
  onParentClick: (uri: string, rkey: string) => void;
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
  const threadModeration = getPostModeration(
    moderation,
    thread,
    userDid,
    sysopDid,
  );

  if (!threadModeration.isVisible) {
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
      <ThreadPostCard
        thread={thread}
        userDid={userDid}
        sysopDid={sysopDid}
        banRkey={threadModeration.banRkey}
        hideRkey={threadModeration.hideRkey}
        onDelete={onDeleteThread}
        onBan={() => onBan(thread.did)}
        onUnban={onUnban}
        onHide={() => onHide(thread.uri)}
        onUnhide={onUnhide}
      />

      {totalPages > 1 && (
        <ReplyPagination
          current={page}
          total={totalPages}
          onGo={onPageChange}
        />
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
          <ReplyPagination
            current={page}
            total={totalPages}
            onGo={onPageChange}
          />
        </div>
      )}
      {children}
    </>
  );
}
