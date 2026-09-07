import DirectoryEntryLink from "./DirectoryEntryLink";
import { bbsUrl } from "../../../frontend/app/router/urls";
import type { DiscoveredBBS } from "../data/discovery";

interface CommunityDirectoryProps {
  discovered: DiscoveredBBS[];
  limit?: number;
}

export default function CommunityDirectory({
  discovered,
  limit = 5,
}: CommunityDirectoryProps) {
  if (discovered.length === 0) return null;

  return (
    <div>
      <p className="text-neutral-400 text-xs uppercase tracking-wide mb-3">
        or try one of these
      </p>
      <div className="space-y-1">
        {discovered.slice(0, limit).map((bbs) => (
          <DirectoryEntryLink
            key={bbs.handle}
            to={bbsUrl(bbs.handle)}
            name={bbs.name}
            description={bbs.handle}
          />
        ))}
      </div>
    </div>
  );
}
