import { Link } from "react-router-dom";
import { formatFullDate, relativeDate } from "../../../ui/dates";
import { profileUrl } from "../../../app/router/urls";

interface PostMetaProps {
  handle: string;
  createdAt: string;
}

export default function PostMeta({ handle, createdAt }: PostMetaProps) {
  return (
    <div className="flex items-baseline gap-2">
      <Link
        to={profileUrl(handle)}
        onClick={(event) => event.stopPropagation()}
        className="text-neutral-200 hover:underline"
      >
        {handle}
      </Link>
      <span className="text-neutral-400">·</span>
      <time
        className="text-xs text-neutral-400"
        title={formatFullDate(createdAt)}
      >
        {relativeDate(createdAt)}
      </time>
    </div>
  );
}
