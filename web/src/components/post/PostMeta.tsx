import { Link } from "react-router-dom";
import { formatFullDate, relativeDate } from "../../lib/util";

interface PostMetaProps {
  handle: string;
  createdAt: string;
}

export default function PostMeta({ handle, createdAt }: PostMetaProps) {
  return (
    <div className="flex items-baseline gap-2">
      <Link
        to={`/profile/${encodeURIComponent(handle)}`}
        className="text-neutral-200 hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {handle}
      </Link>
      <span className="text-neutral-600">·</span>
      <time
        className="text-xs text-neutral-500"
        title={formatFullDate(createdAt)}
      >
        {relativeDate(createdAt)}
      </time>
    </div>
  );
}
