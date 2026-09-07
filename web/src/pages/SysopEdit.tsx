import { useLoaderData, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { putBoard, putSite } from "../lib/communityRecords";
import { deleteRecord } from "../lib/protocol/repository";
import { BOARD } from "../lib/lexicon";
import { nowIso } from "../lib/util";
import { makeAtUri } from "../lib/protocol/uri";
import type { Did } from "@atcute/lexicons/syntax";
import { usePageTitle } from "../hooks/usePageTitle";
import { bbsUrl } from "../lib/routes";
import CommunityForm, {
  type CommunityDraft,
} from "../components/form/CommunityForm";
import type { SysopBBSLoaderData } from "../router/loaders";

export default function SysopEdit() {
  const { repo } = useAuth();
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
    if (!repo) throw new Error("Not signed in");
    const now = nowIso();
    for (const board of draft.boards) {
      await putBoard(repo, board.slug, board.name, board.description, now);
    }
    await putSite(repo, {
      name: draft.name,
      description: draft.description,
      intro: draft.intro,
      boards: draft.boards.map((board) =>
        makeAtUri(user.did as Did, BOARD, board.slug),
      ),
      createdAt: bbs.site.createdAt || now,
      updatedAt: now,
    });
    const currentSlugs = new Set(draft.boards.map((board) => board.slug));
    for (const board of bbs.site.boards) {
      if (!currentSlugs.has(board.slug)) {
        await deleteRecord(repo, BOARD, board.slug);
      }
    }
    navigate(bbsUrl(user.handle));
  }

  return (
    <>
      <h1 className="text-lg text-neutral-200 mb-1">Edit community</h1>
      <p className="text-neutral-400 mb-6">Update your community.</p>
      <CommunityForm
        initialDraft={initialDraft}
        submitLabel="save"
        failureMessage="Could not update community."
        onSave={save}
      />
    </>
  );
}
