import type { ModerationState } from "../../../../atbbs/moderation/read";
import { getPostModeration } from "../../../../atbbs/moderation/policy";
import type { Reply } from "../../../../atbbs/discussion/replies";
import ReplyPostCard from "./ReplyPostCard";

interface ThreadReplyListProps {
  replies: Reply[];
  parentReplies: Record<string, Reply>;
  moderation: ModerationState;
  userDid?: string;
  sysopDid: string;
  onReplyTo: (reply: Reply) => void;
  onParentClick: (uri: string, rkey: string) => void;
  onDelete: (reply: Reply) => void;
  onBan: (did: string) => void;
  onUnban: (rkey: string) => void;
  onHide: (uri: string) => void;
  onUnhide: (rkey: string) => void;
}

export default function ThreadReplyList({
  replies,
  parentReplies,
  moderation,
  userDid,
  sysopDid,
  onReplyTo,
  onParentClick,
  onDelete,
  onBan,
  onUnban,
  onHide,
  onUnhide,
}: ThreadReplyListProps) {
  const visibleReplies = replies.filter(
    (reply) =>
      getPostModeration(moderation, reply, userDid, sysopDid).isVisible,
  );

  if (!visibleReplies.length && !userDid) {
    return <p className="text-neutral-400">No replies yet.</p>;
  }

  return visibleReplies.map((reply) => {
    const parentUri = reply.parent;
    const parentRkey = reply.parentRkey;
    const parentReply = parentUri ? parentReplies[parentUri] : null;
    const replyModeration = getPostModeration(
      moderation,
      reply,
      userDid,
      sysopDid,
    );
    const parentHidden =
      !!parentReply &&
      !getPostModeration(moderation, parentReply, userDid, sysopDid).isVisible;
    return (
      <ReplyPostCard
        key={reply.uri}
        reply={reply}
        userDid={userDid ?? ""}
        sysopDid={sysopDid}
        parentPost={parentHidden ? undefined : (parentReply ?? undefined)}
        banRkey={replyModeration.banRkey}
        hideRkey={replyModeration.hideRkey}
        onReplyTo={() => onReplyTo(reply)}
        onParentClick={
          parentUri && parentRkey
            ? () => onParentClick(parentUri, parentRkey)
            : undefined
        }
        onDelete={() => onDelete(reply)}
        onBan={() => onBan(reply.did)}
        onUnban={onUnban}
        onHide={() => onHide(reply.uri)}
        onUnhide={onUnhide}
      />
    );
  });
}
