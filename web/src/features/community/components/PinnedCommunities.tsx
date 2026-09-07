import { useState } from "react";
import { ChevronDown } from "lucide-react";
import DirectoryEntryLink from "./DirectoryEntryLink";
import { bbsUrl } from "../../../frontend/app/router/urls";
import type { PinnedCommunity } from "../../../atbbs/community/pins";

const PAGE_SIZE = 5;

interface PinnedCommunitiesProps {
  pins: PinnedCommunity[];
}

export default function PinnedCommunities({ pins }: PinnedCommunitiesProps) {
  const [shown, setShown] = useState(PAGE_SIZE);

  if (pins.length === 0)
    return <p className="text-neutral-400">No pinned communities yet.</p>;

  return (
    <div className="space-y-1">
      {pins.slice(0, shown).map((entry) => (
        <DirectoryEntryLink
          key={entry.did}
          to={bbsUrl(entry.handle)}
          name={entry.name}
          description={entry.handle}
          avatar={entry.avatar}
          showAvatar
        />
      ))}
      {shown < pins.length && (
        <button
          onClick={() => setShown((prev) => prev + PAGE_SIZE)}
          className="text-xs text-neutral-400 hover:text-neutral-300 mt-2 inline-flex items-center gap-1"
        >
          <ChevronDown size={12} /> show more
        </button>
      )}
    </div>
  );
}
