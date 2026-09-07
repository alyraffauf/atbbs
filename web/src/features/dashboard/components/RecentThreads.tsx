import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { formatFullDate, relativeDate } from "../../../frontend/ui/dates";
import { parseAtUri } from "../../../atproto/uri";
import { threadUrl } from "../../../frontend/app/router/urls";
import type { MyThread } from "../data/mythreads";

const PAGE_SIZE = 10;

interface RecentThreadsProps {
  threads: MyThread[];
}

export default function RecentThreads({ threads }: RecentThreadsProps) {
  const [shown, setShown] = useState(PAGE_SIZE);

  if (threads.length === 0)
    return <p className="text-neutral-400">No threads yet.</p>;

  return (
    <div>
      {threads.slice(0, shown).map((thread) => {
        const { did, rkey } = parseAtUri(thread.uri);
        const url = threadUrl(thread.bbsHandle, did, rkey);
        return (
          <Link
            key={thread.uri}
            to={url}
            className="block border border-neutral-800/50 rounded p-4 mb-2 hover:bg-neutral-800"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-neutral-200">{thread.title}</span>
              <span className="text-neutral-400">·</span>
              <time
                className="text-xs text-neutral-400"
                title={formatFullDate(thread.createdAt)}
              >
                {relativeDate(thread.createdAt)}
              </time>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              on {thread.bbsHandle}
            </p>
            <p className="text-neutral-400 text-sm line-clamp-2 mt-1">
              {thread.body.substring(0, 200)}
            </p>
          </Link>
        );
      })}
      {shown < threads.length && (
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
