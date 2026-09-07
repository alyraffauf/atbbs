import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth, type AuthUser } from "../../auth/auth";
import { usePageTitle } from "../../../app/browser/usePageTitle";
import {
  discoveryQuery,
  homeSysopQuery,
  pinsQuery,
} from "../../../features/community/queries";
import {
  activityQuery,
  myThreadsQuery,
} from "../../../features/dashboard/queries";
import { queryClient } from "../../../app/queryClient";
import { invalidateAllCommunityCaches } from "../../../features/community/cache";
import CommunityPicker from "../../community/components/CommunityPicker";
import { bbsToSuggestion } from "../../community/data/suggestions";
import PinnedCommunities from "../../community/components/PinnedCommunities";
import RecentThreads from "../components/RecentThreads";
import ActivityFeed from "../components/ActivityFeed";
import CommunitySettings from "../../community/components/CommunitySettings";
import ListSkeleton from "../../../app/layout/ListSkeleton";

type Tab = "inbox" | "threads" | "pinned" | "bbs";

const TAB_STYLE_ACTIVE =
  "py-2 border-b-2 text-neutral-200 border-neutral-200 whitespace-nowrap";
const TAB_STYLE_INACTIVE =
  "py-2 border-b-2 text-neutral-400 hover:text-neutral-300 border-transparent whitespace-nowrap";

interface DashboardPageProps {
  user: AuthUser;
}

export default function DashboardPage({ user }: DashboardPageProps) {
  const { writer } = useAuth();
  const [tab, setTab] = useState<Tab>("inbox");
  usePageTitle("atbbs");

  const { data: sysopInfo } = useQuery(homeSysopQuery(user.did));
  const { data: pins } = useQuery(pinsQuery(user.pdsUrl, user.did));
  const { data: threads } = useQuery(myThreadsQuery(user.pdsUrl, user.did));
  const { data: activity } = useQuery(activityQuery(user.pdsUrl, user.did));
  const { data: discovered } = useQuery(discoveryQuery());

  const pinnedDids = new Set(pins?.map((pin) => pin.did) ?? []);
  const suggestions =
    pins && discovered
      ? [
          ...pins.map(bbsToSuggestion),
          ...discovered
            .filter((bbs) => !pinnedDids.has(bbs.did))
            .slice(0, 5)
            .map(bbsToSuggestion),
        ]
      : undefined;

  const deleteBBSMutation = useMutation({
    mutationFn: async () => {
      if (!writer) throw new Error("Not signed in");
      await writer.deleteCommunity();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(homeSysopQuery(user.did));
      invalidateAllCommunityCaches();
    },
    onError: (error: unknown) => {
      alert(
        error instanceof Error ? error.message : "Could not delete community.",
      );
    },
  });

  function handleDeleteBBS() {
    if (
      !confirm(
        "Are you sure? This will delete your site record, all board records, and all news records. Threads and replies from users will remain in their repos.",
      )
    )
      return;
    deleteBBSMutation.mutate();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "inbox", label: "Activity" },
    { key: "threads", label: "Threads" },
    { key: "pinned", label: "Pins" },
    { key: "bbs", label: "Community" },
  ];

  return (
    <>
      <div className="border-b border-neutral-800 mb-6 pb-4">
        <CommunityPicker discovered={discovered} suggestions={suggestions} />
      </div>

      <div
        role="tablist"
        className="flex gap-4 border-b border-neutral-800 mb-6 overflow-x-auto"
      >
        {tabs.map((tabDef) => (
          <button
            key={tabDef.key}
            role="tab"
            aria-selected={tab === tabDef.key}
            onClick={() => setTab(tabDef.key)}
            className={
              tab === tabDef.key ? TAB_STYLE_ACTIVE : TAB_STYLE_INACTIVE
            }
          >
            {tabDef.label}
          </button>
        ))}
      </div>

      {tab === "inbox" && (
        <>
          <p className="text-neutral-400 text-xs mb-4">
            Recent replies from other users.
          </p>
          {activity ? <ActivityFeed items={activity} /> : <ListSkeleton />}
        </>
      )}

      {tab === "threads" && (
        <>
          <p className="text-neutral-400 text-xs mb-4">
            Threads you've posted across all communities.
          </p>
          {threads ? <RecentThreads threads={threads} /> : <ListSkeleton />}
        </>
      )}

      {tab === "pinned" && (
        <>
          <p className="text-neutral-400 text-xs mb-4">
            Communities you've pinned for quick access.
          </p>
          {pins ? <PinnedCommunities pins={pins} /> : <ListSkeleton />}
        </>
      )}

      {tab === "bbs" && (
        <>
          <p className="text-neutral-400 text-xs mb-4">
            Manage your community.
          </p>
          {sysopInfo ? (
            <CommunitySettings
              hasBBS={sysopInfo.hasBBS}
              userHandle={user.handle}
              userDid={user.did}
              bbsName={sysopInfo.bbsName}
              onDelete={handleDeleteBBS}
            />
          ) : (
            <ListSkeleton />
          )}
        </>
      )}
    </>
  );
}
