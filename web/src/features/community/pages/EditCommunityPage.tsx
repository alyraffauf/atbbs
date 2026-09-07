import { useLoaderData, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth";
import { usePageTitle } from "../../../frontend/app/browser/usePageTitle";
import { bbsUrl } from "../../../frontend/app/router/urls";
import CommunityEditor, {
  type CommunityDraft,
} from "../components/CommunityEditor";
import type { SysopBBSLoaderData } from "../../../app/router/loaders";
import { invalidateAllCommunityCaches } from "../../../frontend/features/community/cache";

export default function EditCommunityPage() {
  const { writer } = useAuth();
  const navigate = useNavigate();
  const { user, bbs } = useLoaderData() as SysopBBSLoaderData;

  const initialDraft: CommunityDraft = {
    name: bbs.site.name,
    description: bbs.site.description,
    intro: bbs.site.intro,
    boards: bbs.site.boards.map((board) => ({
      slug: board.slug,
      name: board.name,
      description: board.description,
    })),
  };

  usePageTitle("Edit community — atbbs");

  async function save(draft: CommunityDraft) {
    if (!writer) throw new Error("Not signed in");
    await writer.updateCommunity(draft);
    invalidateAllCommunityCaches();
    navigate(bbsUrl(user.handle));
  }

  return (
    <>
      <h1 className="text-lg text-neutral-200 mb-1">Edit community</h1>
      <p className="text-neutral-400 mb-6">Update your community.</p>
      <CommunityEditor
        initialDraft={initialDraft}
        submitLabel="save"
        failureMessage="Could not update community."
        onSave={save}
      />
    </>
  );
}
