import { Ban, EyeOff } from "lucide-react";

interface ModerationBadgeProps {
  isHidden: boolean;
  isBannedAuthor: boolean;
}

export default function ModerationBadge({
  isHidden,
  isBannedAuthor,
}: ModerationBadgeProps) {
  if (!isHidden && !isBannedAuthor) return null;
  return (
    <span
      title="Only visible to you as sysop."
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500 border border-neutral-800 rounded px-1.5 py-0.5 mb-2"
    >
      {isHidden ? <EyeOff size={10} /> : <Ban size={10} />}
      {isHidden ? "hidden" : "author banned"}
    </span>
  );
}
