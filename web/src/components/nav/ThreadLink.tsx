import { Link } from "react-router-dom";
import Avatar from "../Avatar";
import type { Participant } from "../../lib/boardThreads";

const COL_POSTERS = "w-20";
const COL_REPLIES = "w-14";
const COL_ACTIVITY = "w-16";

const MAX_AVATARS = 3;

export function ThreadListHeader() {
  return (
    <div className="hidden sm:flex items-center gap-4 px-3 -mx-3 pb-2 border-b border-neutral-800 text-xs text-neutral-500">
      <span className="flex-1 min-w-0">Topic</span>
      <span className={`shrink-0 ${COL_POSTERS} text-center`}>Posters</span>
      <span className={`shrink-0 ${COL_REPLIES} text-center`}>Replies</span>
      <span className={`shrink-0 ${COL_ACTIVITY} text-center`}>Activity</span>
    </div>
  );
}

interface ThreadLinkProps {
  to: string;
  title: string;
  preview?: string;
  authorHandle: string;
  participants: Participant[];
  replyCount: number;
  activity: string;
}

export default function ThreadLink({
  to,
  title,
  preview,
  authorHandle,
  participants,
  replyCount,
  activity,
}: ThreadLinkProps) {
  const shownPosters = participants.slice(0, MAX_AVATARS);
  const hiddenPosterCount = participants.length - shownPosters.length;
  return (
    <Link
      to={to}
      className="block px-3 py-3 -mx-3 rounded hover:bg-neutral-800 group"
    >
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-neutral-300 truncate">{title}</span>
          <span className="shrink-0 text-xs text-neutral-400">
            {authorHandle} · {activity}
          </span>
        </div>
        {preview && (
          <p className="text-neutral-400 text-xs mt-1 line-clamp-1">
            {preview}
          </p>
        )}
      </div>

      <div className="hidden sm:flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-neutral-300 truncate">{title}</div>
          {preview && (
            <div className="text-xs text-neutral-400 truncate mt-1">
              {preview}
            </div>
          )}
        </div>
        <div
          className={`shrink-0 flex items-center justify-center -space-x-2 ${COL_POSTERS} pt-0.5`}
        >
          {shownPosters.map((poster) => (
            <div
              key={poster.did}
              className="rounded-full ring-2 ring-neutral-900 group-hover:ring-neutral-800"
            >
              <Avatar url={poster.avatar} name={poster.handle} size={20} />
            </div>
          ))}
          {hiddenPosterCount > 0 && (
            <span className="text-xs text-neutral-400 pl-3 tabular-nums">
              +{hiddenPosterCount}
            </span>
          )}
        </div>
        <span
          className={`shrink-0 ${COL_REPLIES} text-center text-xs text-neutral-400 tabular-nums pt-1`}
        >
          {replyCount || null}
        </span>
        <span
          className={`shrink-0 ${COL_ACTIVITY} text-center text-xs text-neutral-400 pt-1`}
        >
          {activity}
        </span>
      </div>
    </Link>
  );
}
