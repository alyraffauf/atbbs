import { useRef, useState, useEffect } from "react";
import { Reply, MoreHorizontal, Trash2, Ban, EyeOff, Eye } from "lucide-react";

interface PostActionsProps {
  isAuthor: boolean;
  isSysop: boolean;
  banRkey?: string | null;
  hideRkey?: string | null;
  onDelete?: () => void;
  onBan?: () => void;
  onUnban?: (rkey: string) => void;
  onHide?: () => void;
  onUnhide?: (rkey: string) => void;
  onReplyTo?: () => void;
}

export default function PostActions({
  isAuthor,
  isSysop,
  banRkey,
  hideRkey,
  onDelete,
  onBan,
  onUnban,
  onHide,
  onUnhide,
  onReplyTo,
}: PostActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const canDelete = isAuthor && !!onDelete;
  const canBan = isSysop && !isAuthor && !!onBan && !banRkey;
  const canUnban = isSysop && !!onUnban && !!banRkey;
  const canHide = isSysop && !!onHide && !hideRkey;
  const canUnhide = isSysop && !!onUnhide && !!hideRkey;
  const hasModActions = canDelete || canBan || canUnban || canHide || canUnhide;

  if (!onReplyTo && !hasModActions) return null;

  function select(action: () => void) {
    setOpen(false);
    action();
  }

  const menuItem =
    "flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800";
  const dangerItem = menuItem + " hover:text-red-400";

  return (
    <div className="relative post-actions" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="text-neutral-400 hover:text-neutral-300"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded shadow-lg z-10 py-1 min-w-28">
          {onReplyTo && (
            <button onClick={() => select(onReplyTo)} className={menuItem}>
              <Reply size={12} /> reply
            </button>
          )}

          {onReplyTo && hasModActions && (
            <div className="border-t border-neutral-800 my-1" />
          )}

          {canDelete && (
            <button onClick={() => select(onDelete)} className={dangerItem}>
              <Trash2 size={12} /> delete
            </button>
          )}
          {canBan && (
            <button onClick={() => select(onBan)} className={dangerItem}>
              <Ban size={12} /> ban
            </button>
          )}
          {canUnban && (
            <button
              onClick={() => select(() => onUnban!(banRkey!))}
              className={menuItem}
            >
              <Ban size={12} /> unban
            </button>
          )}
          {canHide && (
            <button onClick={() => select(onHide)} className={dangerItem}>
              <EyeOff size={12} /> hide
            </button>
          )}
          {canUnhide && (
            <button
              onClick={() => select(() => onUnhide!(hideRkey!))}
              className={menuItem}
            >
              <Eye size={12} /> unhide
            </button>
          )}
        </div>
      )}
    </div>
  );
}
