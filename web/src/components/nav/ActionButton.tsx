import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

const actionStyle =
  "inline-flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4 py-2 rounded whitespace-nowrap";

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

interface ActionLinkProps {
  to: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function ActionButton({
  onClick,
  children,
  icon: Icon,
  className,
}: ActionButtonProps) {
  return (
    <button onClick={onClick} className={`${actionStyle} ${className ?? ""}`}>
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

export function ActionLink({ to, children, icon: Icon, className }: ActionLinkProps) {
  return (
    <Link to={to} className={`${actionStyle} ${className ?? ""}`}>
      {Icon && <Icon size={14} />}
      {children}
    </Link>
  );
}
