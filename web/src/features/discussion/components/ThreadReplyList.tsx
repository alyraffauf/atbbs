import type { BBSModeration } from "../../moderation/data/bbsModeration";
import type { Reply } from "../../../atbbs/discussion/replies";
import ReplyPostCard from "./ReplyPostCard";

interface ThreadReplyListProps {
  replies: Reply[];
  parentReplies: Record<string, Reply>;
  moderation: BBSModeration;
  userDid?: string;
  sysopDid: string;
  onReplyTo: (reply: Reply) => void;
  onParentClick: (uri: string) => void;
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
  const isSysop = userDid === sysopDid;
  const visibleReplies = isSysop
    ? replies
    : replies.filter(
        (reply) =>
          !moderation.banRkeys[reply.did] && !moderation.hideRkeys[reply.uri],
      );

  if (!visibleReplies.length && !userDid) {
    return <p className="text-neutral-400">No replies yet.</p>;
  }

  return visibleReplies.map((reply) => {
    const parentUri = reply.parent;
    const parentReply = parentUri ? parentReplies[parentUri] : null;
    const parentHidden =
      !!parentReply &&
      !isSysop &&
      (!!moderation.banRkeys[parentReply.did] ||
        !!moderation.hideRkeys[parentReply.uri]);
    return (
      <ReplyPostCard
        key={reply.uri}
        reply={reply}
        userDid={userDid ?? ""}
        sysopDid={sysopDid}
        parentPost={parentHidden ? undefined : (parentReply ?? undefined)}
        banRkey={moderation.banRkeys[reply.did]?.[0] ?? null}
        hideRkey={moderation.hideRkeys[reply.uri]?.[0] ?? null}
        onReplyTo={() => onReplyTo(reply)}
        onParentClick={parentUri ? () => onParentClick(parentUri) : undefined}
        onDelete={() => onDelete(reply)}
        onBan={() => onBan(reply.did)}
        onUnban={onUnban}
        onHide={() => onHide(reply.uri)}
        onUnhide={onUnhide}
      />
    );
  });
}
