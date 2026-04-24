import { Link } from "react-router-dom";
import { Pencil, ChevronRight, Monitor } from "lucide-react";
import Avatar from "../Avatar";
import PostBody from "../post/PostBody";
import { ActionButton } from "../nav/ActionButton";
import { bbsUrl } from "../../lib/routes";
import type { Profile } from "../../lib/profile";

interface ViewProfileProps {
  handle: string;
  profile: Profile | null;
  isOwner: boolean;
  onEdit: () => void;
}

export default function ViewProfile({
  handle,
  profile,
  isOwner,
  onEdit,
}: ViewProfileProps) {
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar
          url={profile?.avatar}
          name={profile?.name ?? handle}
          size={48}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-lg text-neutral-200 mb-1 truncate">
              {profile?.name ?? handle}
            </h1>
            {isOwner && (
              <ActionButton onClick={onEdit} icon={Pencil}>
                edit
              </ActionButton>
            )}
          </div>
          <p className="text-neutral-400 truncate">
            {handle}
            {profile?.pronouns && (
              <>
                <span className="text-neutral-400 mx-1">·</span>
                {profile.pronouns}
              </>
            )}
          </p>
        </div>
      </div>
      {profile?.bio && (
        <div className="mt-4">
          <PostBody>{profile.bio}</PostBody>
        </div>
      )}
      {profile?.bbsName && (
        <div className="mt-6">
          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2 inline-flex items-center gap-1.5">
            <Monitor size={12} /> Community
          </p>
          <Link
            to={bbsUrl(handle)}
            className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded px-4 py-3 hover:border-neutral-700 group"
          >
            <div>
              <div className="text-neutral-200">{profile.bbsName}</div>
              {profile.bbsDescription && (
                <div className="text-xs text-neutral-400 mt-1">
                  {profile.bbsDescription}
                </div>
              )}
            </div>
            <ChevronRight
              size={18}
              className="text-neutral-400 group-hover:text-neutral-300 ml-4"
            />
          </Link>
        </div>
      )}
      {!profile?.name && !profile?.bio && !profile?.bbsName && !isOwner && (
        <p className="text-neutral-400 mt-4">No profile yet.</p>
      )}
    </>
  );
}
