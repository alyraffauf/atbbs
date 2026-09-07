import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/auth";
import { createBoard, createSite } from "../lib/communityRecords";
import { deleteRecord } from "../shared/protocol/repository";
import { BOARD } from "../shared/config/lexicon";
import { DEFAULT_BOARD } from "../shared/config/shared";
import { nowIso } from "../shared/config/util";
import { makeAtUri } from "../shared/protocol/uri";
import type { Did } from "@atcute/lexicons/syntax";
import { usePageTitle } from "../shared/hooks/usePageTitle";
import { bbsUrl } from "../shared/config/routes";
import CommunityForm, {
  type CommunityDraft,
} from "../components/form/CommunityForm";

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

export default function SysopCreate() {
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
      <CommunityForm
        initialDraft={initialDraft}
        submitLabel="create bbs"
        failureMessage="Could not create community."
        onSave={save}
      />
    </>
  );
}
