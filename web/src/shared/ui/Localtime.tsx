import { formatFullDate, relativeDate } from "../../frontend/ui/dates";

export default function Localtime({ iso }: { iso: string }) {
  if (!iso) return null;
  return (
    <time className="text-xs text-neutral-400" title={formatFullDate(iso)}>
      {relativeDate(iso)}
    </time>
  );
}
