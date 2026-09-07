import { useLoaderData, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth";
import { putBoard, putSite } from "../data/communityRecords";
import { deleteRecord } from "../../../shared/protocol/repository";
import { BOARD } from "../../../atbbs/schema/collections";
import { nowIso } from "../../../atbbs/support/time";
import { makeAtUri } from "../../../atproto/uri";
import type { Did } from "@atcute/lexicons/syntax";
import { usePageTitle } from "../../../frontend/app/browser/usePageTitle";
import { bbsUrl } from "../../../frontend/app/router/urls";
import CommunityEditor, {
  type CommunityDraft,
} from "../components/CommunityEditor";
import type { SysopBBSLoaderData } from "../../../app/router/loaders";

export default function EditCommunityPage() {
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
      <CommunityEditor
        initialDraft={initialDraft}
        submitLabel="save"
        failureMessage="Could not update community."
        onSave={save}
      />
    </>
  );
}
