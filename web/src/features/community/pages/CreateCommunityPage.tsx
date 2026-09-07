import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth";
import { DEFAULT_BOARD } from "../../../atbbs/community/config";
import { usePageTitle } from "../../../frontend/app/browser/usePageTitle";
import { bbsUrl } from "../../../frontend/app/router/urls";
import CommunityEditor, {
  type CommunityDraft,
} from "../components/CommunityEditor";
import { invalidateAllCommunityCaches } from "../../../frontend/features/community/cache";

const initialDraft: CommunityDraft = {
  name: "",
  description: "",
  intro: "",
  boards: [
    {
      slug: DEFAULT_BOARD.slug,
      name: DEFAULT_BOARD.name,
      description: DEFAULT_BOARD.description,
    },
  ],
};

export default function CreateCommunityPage() {
  const { user, writer } = useAuth();
  const navigate = useNavigate();

  usePageTitle("Create community — atbbs");

  async function save(draft: CommunityDraft) {
    if (!writer || !user) throw new Error("Not signed in");
    try {
      await writer.createCommunity(draft);
      invalidateAllCommunityCaches();
      navigate(bbsUrl(user.handle));
    } catch {
      throw new Error("Could not create community");
    }
  }

  return (
    <>
      <h1 className="text-lg text-neutral-200 mb-1">Create a community</h1>
      <p className="text-neutral-400 mb-6">
        Set up your community. Your handle becomes the address.
      </p>
      <CommunityEditor
        initialDraft={initialDraft}
        submitLabel="create bbs"
        failureMessage="Could not create community."
        onSave={save}
      />
    </>
  );
}
