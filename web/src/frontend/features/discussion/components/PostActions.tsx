import { useRef } from "react";
import { Reply, MoreHorizontal, Trash2, Ban, EyeOff, Eye } from "lucide-react";

export type PostAction =
  | { kind: "reply"; onSelect: () => void }
  | { kind: "delete"; onSelect: () => void }
  | { kind: "ban"; onSelect: () => void }
  | { kind: "unban"; onSelect: () => void }
  | { kind: "hide"; onSelect: () => void }
  | { kind: "unhide"; onSelect: () => void };

interface PostActionsProps {
  actions: PostAction[];
}

const actionDetails = {
  reply: { label: "reply", icon: Reply, destructive: false },
  delete: { label: "delete", icon: Trash2, destructive: true },
  ban: { label: "ban", icon: Ban, destructive: true },
  unban: { label: "unban", icon: Ban, destructive: false },
  hide: { label: "hide", icon: EyeOff, destructive: true },
  unhide: { label: "unhide", icon: Eye, destructive: false },
} as const;

export default function PostActions({ actions }: PostActionsProps) {
  const disclosureRef = useRef<HTMLDetailsElement>(null);

  if (!actions.length) return null;

  function select(action: () => void) {
    disclosureRef.current?.removeAttribute("open");
    action();
  }

  const menuItem =
    "flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800";
  const dangerItem = menuItem + " hover:text-red-400";

  return (
    <details className="relative post-actions" ref={disclosureRef}>
      <summary
        aria-label="Post actions"
        className="text-neutral-400 hover:text-neutral-300 cursor-pointer list-none [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal size={16} />
      </summary>

      <div className="absolute right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded shadow-lg z-10 py-1 min-w-28">
        {actions.map((action, index) => {
          const details = actionDetails[action.kind];
          const Icon = details.icon;
          const followsReply = index === 1 && actions[0]?.kind === "reply";
          return (
            <div key={action.kind}>
              {followsReply && (
                <div className="border-t border-neutral-800 my-1" />
              )}
              <button
                onClick={() => select(action.onSelect)}
                className={details.destructive ? dangerItem : menuItem}
              >
                <Icon size={12} /> {details.label}
              </button>
            </div>
          );
        })}
      </div>
    </details>
  );
}
