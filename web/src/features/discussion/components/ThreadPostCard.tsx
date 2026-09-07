import type { ThreadRoot } from "../data/thread";
import ModerationBadge from "./ModerationBadge";
import PostActions, { type PostAction } from "./PostActions";
import PostContent from "./PostContent";
import PostMeta from "./PostMeta";

interface ThreadPostCardProps {
  thread: ThreadRoot;
  userDid?: string;
  sysopDid: string;
  banRkey?: string | null;
  hideRkey?: string | null;
  onDelete: () => void;
  onBan: () => void;
  onUnban: (rkey: string) => void;
  onHide: () => void;
  onUnhide: (rkey: string) => void;
}

export default function ThreadPostCard({
  thread,
  userDid,
  sysopDid,
  banRkey,
  hideRkey,
  onDelete,
  onBan,
  onUnban,
  onHide,
  onUnhide,
}: ThreadPostCardProps) {
  const isAuthor = !!(userDid && userDid === thread.did);
  const isSysop = !!(userDid && userDid === sysopDid);
  const isModerated = !!banRkey || !!hideRkey;
  const actions: PostAction[] = [];
  if (isAuthor) actions.push({ kind: "delete", onSelect: onDelete });
  if (isSysop && !isAuthor && !banRkey) {
    actions.push({ kind: "ban", onSelect: onBan });
  }
  if (isSysop && banRkey) {
    actions.push({ kind: "unban", onSelect: () => onUnban(banRkey) });
  }
  if (isSysop && !hideRkey) actions.push({ kind: "hide", onSelect: onHide });
  if (isSysop && hideRkey) {
    actions.push({ kind: "unhide", onSelect: () => onUnhide(hideRkey) });
  }

  return (
    <article
      className={`reply-card bg-neutral-900 border rounded p-4 mb-4 ${
        isModerated ? "border-neutral-800 opacity-60" : "border-neutral-800"
      }`}
    >
      <div className="flex items-baseline justify-between mb-3">
        <PostMeta handle={thread.authorHandle} createdAt={thread.createdAt} />
        <PostActions actions={actions} />
      </div>
      <ModerationBadge isHidden={!!hideRkey} isBannedAuthor={!!banRkey} />
      <h1 className="text-lg text-neutral-200 font-bold mb-3">
        {thread.title}
      </h1>
      <PostContent
        body={thread.body}
        attachments={thread.attachments}
        pds={thread.authorPds}
        did={thread.did}
        attachmentListClassName="mt-3 space-y-1"
      />
    </article>
  );
}
