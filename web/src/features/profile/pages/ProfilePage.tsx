import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useAuth } from "../../auth/auth";
import { usePageTitle } from "../../../shared/hooks/usePageTitle";
import { putProfile } from "../data/profileRecords";
import { myThreadsQuery } from "../../dashboard/data/dashboardQueries";
import { profileQuery } from "../data/profileQueries";
import { queryClient } from "../../../app/queryClient";
import ProfileView from "../components/ProfileView";
import ProfileEditor from "../components/ProfileEditor";
import RecentThreads from "../../dashboard/components/RecentThreads";
import ListSkeleton from "../../../app/layout/ListSkeleton";

export default function ProfilePage() {
  const { handle } = useParams();
  const { user, repo } = useAuth();
  const [editing, setEditing] = useState(false);

  const { data: profile } = useQuery(profileQuery(handle!));
  const { data: threads } = useQuery({
    ...myThreadsQuery(profile?.pdsUrl ?? "", profile?.did ?? ""),
    enabled: !!profile,
  });

  usePageTitle(`${profile?.name ?? handle} — atbbs`);

  const isOwner = user?.handle === handle;

  const saveProfileMutation = useMutation({
    mutationFn: async (input: {
      name?: string;
      pronouns?: string;
      bio?: string;
    }) => {
      if (!repo) throw new Error("Not signed in");
      await putProfile(repo, input.name, input.pronouns, input.bio);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(profileQuery(handle!));
      setEditing(false);
    },
  });

  if (editing) {
    return (
      <ProfileEditor
        initialName={profile?.name ?? ""}
        initialPronouns={profile?.pronouns ?? ""}
        initialBio={profile?.bio ?? ""}
        onSave={(name, pronouns, bio) =>
          saveProfileMutation.mutateAsync({ name, pronouns, bio })
        }
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      <ProfileView
        handle={handle!}
        profile={profile ?? null}
        isOwner={isOwner}
        onEdit={() => setEditing(true)}
      />
      <div className="mt-8">
        <p className="text-xs text-neutral-400 uppercase tracking-wide mb-3 inline-flex items-center gap-1.5">
          <MessageSquare size={12} /> Recent Threads
        </p>
        {threads ? (
          <RecentThreads threads={threads.slice(0, 5)} />
        ) : (
          <ListSkeleton />
        )}
      </div>
    </>
  );
}
