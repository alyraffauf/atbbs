import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth";
import { createBoard, createSite } from "../data/communityRecords";
import { deleteRecord } from "../../../shared/protocol/repository";
import { BOARD } from "../../../atbbs/schema/collections";
import { DEFAULT_BOARD } from "../../../atbbs/community/config";
import { nowIso } from "../../../atbbs/support/time";
import { makeAtUri } from "../../../atproto/uri";
import type { Did } from "@atcute/lexicons/syntax";
import { usePageTitle } from "../../../frontend/app/browser/usePageTitle";
import { bbsUrl } from "../../../frontend/app/router/urls";
import CommunityEditor, {
  type CommunityDraft,
} from "../components/CommunityEditor";

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
  const { user, repo } = useAuth();
  const navigate = useNavigate();

  usePageTitle("Create community — atbbs");

  async function save(draft: CommunityDraft) {
    if (!repo || !user) throw new Error("Not signed in");
    const now = nowIso();
    const createdSlugs: string[] = [];
    try {
      for (const board of draft.boards) {
        await createBoard(repo, board.slug, board.name, board.description, now);
        createdSlugs.push(board.slug);
      }
      await createSite(repo, {
        name: draft.name,
        description: draft.description,
        intro: draft.intro,
        boards: draft.boards.map((board) =>
          makeAtUri(user.did as Did, BOARD, board.slug),
        ),
        createdAt: now,
      });
      navigate(bbsUrl(user.handle));
    } catch {
      for (const slug of [...createdSlugs].reverse()) {
        try {
          await deleteRecord(repo, BOARD, slug);
        } catch {
          // Preserve the original create failure; incomplete cleanup is retryable.
        }
      }
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
