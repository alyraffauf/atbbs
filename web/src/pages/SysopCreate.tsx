import { useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { createBoard, createSite, deleteRecord } from "../lib/writes";
import { BOARD } from "../lib/lexicon";
import { DEFAULT_BOARD } from "../lib/shared";
import { makeAtUri, nowIso } from "../lib/util";
import type { Did } from "@atcute/lexicons/syntax";
import * as limits from "../lib/limits";
import { usePageTitle } from "../hooks/usePageTitle";
import { bbsUrl } from "../lib/routes";
import { Input, Textarea, Button } from "../components/form/Form";
import BoardRowEditor, {
  type BoardRow,
} from "../components/form/BoardRowEditor";

export default function SysopCreate() {
  const { user, repo } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [intro, setIntro] = useState("");
  const [boards, setBoards] = useState<BoardRow[]>([
    {
      slug: DEFAULT_BOARD.slug,
      name: DEFAULT_BOARD.name,
      description: DEFAULT_BOARD.description,
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  usePageTitle("Create community — atbbs");

  async function onSubmit(e: SyntheticEvent) {
    e.preventDefault();
    if (!repo || !user) return;
    const cleanBoards = boards
      .map((board) => ({
        slug: board.slug.trim(),
        name: board.name.trim(),
        description: board.description.trim(),
      }))
      .filter((board) => board.slug);
    if (!name.trim() || !cleanBoards.length) {
      setError("Name and at least one board are required.");
      return;
    }
    if (cleanBoards.length > limits.MAX_BOARDS) {
      setError(`A community can have at most ${limits.MAX_BOARDS} boards.`);
      return;
    }
    const now = nowIso();
    const createdSlugs: string[] = [];
    try {
      for (const board of cleanBoards) {
        await createBoard(
          repo,
          board.slug,
          board.name || board.slug,
          board.description,
          now,
        );
        createdSlugs.push(board.slug);
      }
      await createSite(repo, {
        name: name.trim(),
        description: description.trim(),
        intro,
        boards: cleanBoards.map((board) =>
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
      setError("Could not create community.");
    }
  }

  return (
    <>
      <h1 className="text-lg text-neutral-200 mb-1">Create a community</h1>
      <p className="text-neutral-400 mb-6">
        Set up your community. Your handle becomes the address.
      </p>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label className="text-xs text-neutral-400 uppercase tracking-wide">
            Community Name
          </label>
          <Input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Cool Community"
            maxLength={limits.SITE_NAME}
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400 uppercase tracking-wide">
            Description
          </label>
          <Input
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description of your community"
            maxLength={limits.SITE_DESCRIPTION}
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400 uppercase tracking-wide">
            Welcome Message
          </label>
          <Textarea
            name="intro"
            rows={6}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="ASCII art, rules, welcome message..."
            maxLength={limits.SITE_INTRO}
          />
        </div>
        <BoardRowEditor boards={boards} onChange={setBoards} />
        <Button type="submit">create bbs</Button>
      </form>
    </>
  );
}
