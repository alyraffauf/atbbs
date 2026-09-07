import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { threadUrl } from "../../../app/router/urls";
import PostBody from "../../discussion/components/PostBody";
import PostMeta from "../../discussion/components/PostMeta";
import type { ActivityItem } from "../../../../atbbs/dashboard/activity";
import { parseAtUri } from "../../../../atproto/uri";

const PAGE_SIZE = 10;

interface ActivityFeedProps {
  items: ActivityItem[];
}

export default function ActivityFeed({ items }: ActivityFeedProps) {
  const [shown, setShown] = useState(PAGE_SIZE);

  if (items.length === 0)
    return <p className="text-neutral-400">No activity yet.</p>;

  return (
    <div>
      {items.slice(0, shown).map((item) => {
        const thread = parseAtUri(item.threadUri);
        const reply = parseAtUri(item.replyUri);
        const url = `${threadUrl(item.bbsHandle, thread.did, thread.rkey)}#reply-${reply.rkey}`;
        return (
          <div
            key={item.replyUri}
            className="relative border border-neutral-800/50 rounded p-4 mb-2 hover:bg-neutral-800"
          >
            <Link
              to={url}
              aria-label={`Open activity on ${item.threadTitle || "thread"}`}
              className="absolute inset-0"
            />
            <div className="relative pointer-events-none [&_a]:pointer-events-auto">
              <PostMeta handle={item.handle} createdAt={item.createdAt} />
              <p className="text-xs text-neutral-400 mb-1">
                {item.type === "parent_reply"
                  ? "replied to your reply"
                  : `on: ${item.threadTitle}`}
              </p>
              <div className="line-clamp-2">
                <PostBody>{item.body}</PostBody>
              </div>
            </div>
          </div>
        );
      })}
      {shown < items.length && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShown((prev) => prev + PAGE_SIZE)}
            className="text-neutral-400 hover:text-neutral-300 inline-flex items-center gap-1"
          >
            <ChevronDown size={14} /> show more
          </button>
        </div>
      )}
    </div>
  );
}
