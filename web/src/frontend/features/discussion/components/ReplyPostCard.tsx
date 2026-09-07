import { truncate } from "../../../../atbbs/support/text";
import ModerationBadge from "./ModerationBadge";
import PostActions, { type PostAction } from "./PostActions";
import PostBody from "./PostBody";
import PostContent from "./PostContent";
import PostMeta from "./PostMeta";
import type { Reply } from "../../../../atbbs/discussion/replies";

interface ReplyPostCardProps {
  reply: Reply;
  userDid: string;
  sysopDid: string;
  parentPost?: Reply;
  banRkey?: string | null;
  hideRkey?: string | null;
  onReplyTo: () => void;
  onParentClick?: () => void;
  onDelete: () => void;
  onBan: () => void;
  onUnban: (rkey: string) => void;
  onHide: () => void;
  onUnhide: (rkey: string) => void;
}

export default function ReplyPostCard({
  reply,
  userDid,
  sysopDid,
  parentPost,
  banRkey,
  hideRkey,
  onReplyTo,
  onParentClick,
  onDelete,
  onBan,
  onUnban,
  onHide,
  onUnhide,
}: ReplyPostCardProps) {
  const isAuthor = userDid === reply.did;
  const isSysop = userDid === sysopDid;
  const isModerated = !!banRkey || !!hideRkey;
  const actions: PostAction[] = [];
  if (userDid) actions.push({ kind: "reply", onSelect: onReplyTo });
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
    <div
      id={`reply-${reply.rkey}`}
      className={`reply-card border rounded p-4 ${
        isModerated
          ? "border-neutral-800 bg-neutral-900/30 opacity-60"
          : "border-neutral-800/50"
      }`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <PostMeta handle={reply.handle} createdAt={reply.createdAt} />
        <PostActions actions={actions} />
      </div>

      <ModerationBadge isHidden={!!hideRkey} isBannedAuthor={!!banRkey} />

      {parentPost && (
        <button
          type="button"
          onClick={onParentClick}
          className="block w-full text-left border-l-2 border-neutral-700 pl-3 mb-3 py-1 text-sm text-neutral-400 hover:border-neutral-500 cursor-pointer"
        >
          <span className="text-neutral-400">{parentPost.handle}:</span>{" "}
          <PostBody>{truncate(parentPost.body, 200)}</PostBody>
        </button>
      )}

      <PostContent
        body={reply.body}
        attachments={reply.attachments}
      />
    </div>
  );
}
