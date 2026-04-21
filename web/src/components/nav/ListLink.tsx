import { Link } from "react-router-dom";
import Avatar from "../Avatar";

interface ListLinkProps {
  to: string;
  name: string;
  description?: string;
  avatar?: string;
  showAvatar?: boolean;
}

export default function ListLink({
  to,
  name,
  description,
  avatar,
  showAvatar,
}: ListLinkProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2 -mx-3 rounded hover:bg-neutral-800 group"
    >
      {showAvatar && <Avatar url={avatar} name={name} />}
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 min-w-0">
        <span className="text-neutral-200 truncate">{name}</span>
        {description && (
          <span className="text-neutral-400 text-xs sm:text-sm truncate">
            {description}
          </span>
        )}
      </div>
    </Link>
  );
}
