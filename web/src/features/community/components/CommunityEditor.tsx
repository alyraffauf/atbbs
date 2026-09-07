import { useState, type SyntheticEvent } from "react";

import * as limits from "../../../shared/config/limits";
import BoardEditorRow, { type BoardRow } from "./BoardEditorRow";
import { Button, Input, Textarea } from "../../../shared/ui/Form";

export interface CommunityDraft {
  name: string;
  description: string;
  intro: string;
  boards: BoardRow[];
}

interface CommunityEditorProps {
  initialDraft: CommunityDraft;
  submitLabel: string;
  failureMessage: string;
  onSave: (draft: CommunityDraft) => Promise<void>;
}

function normalizeDraft(draft: CommunityDraft): CommunityDraft {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    intro: draft.intro,
    boards: draft.boards
      .map((board) => ({
        slug: board.slug.trim(),
        name: board.name.trim() || board.slug.trim(),
        description: board.description.trim(),
      }))
      .filter((board) => board.slug),
  };
}

export default function CommunityEditor({
  initialDraft,
  submitLabel,
  failureMessage,
  onSave,
}: CommunityEditorProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    if (isPending) return;

    const normalized = normalizeDraft(draft);
    if (!normalized.name || !normalized.boards.length) {
      setError("Name and at least one board are required.");
      return;
    }
    if (normalized.boards.length > limits.MAX_BOARDS) {
      setError(`A community can have at most ${limits.MAX_BOARDS} boards.`);
      return;
    }

    setError(null);
    setIsPending(true);
    try {
      await onSave(normalized);
    } catch {
      setError(failureMessage);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label className="text-xs text-neutral-400 uppercase tracking-wide">
            Community Name
          </label>
          <Input
            name="name"
            required
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
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
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
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
            value={draft.intro}
            onChange={(event) =>
              setDraft({ ...draft, intro: event.target.value })
            }
            placeholder="ASCII art, rules, welcome message..."
            maxLength={limits.SITE_INTRO}
          />
        </div>
        <BoardEditorRow
          boards={draft.boards}
          onChange={(boards) => setDraft({ ...draft, boards })}
        />
        <Button type="submit" disabled={isPending}>
          {submitLabel}
        </Button>
      </form>
    </>
  );
}
