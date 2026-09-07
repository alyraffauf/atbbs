import { useRef, useState, type SyntheticEvent } from "react";
import { Send, Paperclip } from "lucide-react";
import { Input, Textarea, Button } from "./Form";
import FileChips from "./FileChips";
import { MAX_ATTACHMENTS } from "../../lib/limits";

export interface PostDraft {
  body: string;
  title?: string;
  files: File[];
}

interface FieldConfig {
  placeholder?: string;
  maxLength?: number;
}

interface ComposeFormProps {
  onSave: (draft: PostDraft) => Promise<unknown>;
  initialDraft?: Partial<PostDraft>;
  bodyPlaceholder?: string;
  bodyRows?: number;
  bodyMaxLength?: number;
  title?: FieldConfig;
  replyingTo?: { uri: string; handle: string } | null;
  onClearReplyTo?: () => void;
  submitLabel?: string;
  className?: string;
}

export default function ComposeForm({
  onSave,
  initialDraft,
  bodyPlaceholder = "What's on your mind?",
  bodyRows = 4,
  title,
  replyingTo,
  onClearReplyTo,
  bodyMaxLength,
  submitLabel = "post",
  className = "",
}: ComposeFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const postingRef = useRef(false);
  const [draft, setDraft] = useState<PostDraft>(() => ({
    body: initialDraft?.body ?? "",
    ...(title ? { title: initialDraft?.title ?? "" } : {}),
    files: [...(initialDraft?.files ?? [])],
  }));
  const [posting, setPosting] = useState(false);

  const body = draft.body;
  const files = draft.files;

  function updateDraft(update: Partial<PostDraft>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function insertSnippet(snippet: string) {
    const textarea = textareaRef.current;
    const isFocused = !!textarea && document.activeElement === textarea;
    if (!textarea || !isFocused) {
      const sep = body.length > 0 && !body.endsWith("\n") ? "\n" : "";
      updateDraft({ body: body + sep + snippet });
      return;
    }
    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const next = body.slice(0, start) + snippet + body.slice(end);
    updateDraft({ body: next });
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + snippet.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const combined = [...files, ...Array.from(fileList)].slice(
      0,
      MAX_ATTACHMENTS,
    );
    updateDraft({ files: combined });
  }

  const attachmentsAtLimit = files.length >= MAX_ATTACHMENTS;

  function removeFile(index: number) {
    updateDraft({ files: files.filter((_, i) => i !== index) });
  }

  function insertAttachment(file: File) {
    const encoded = encodeURIComponent(file.name);
    const snippet = file.type.startsWith("image/")
      ? `![${file.name}](attachment:${encoded})`
      : `[${file.name}](attachment:${encoded})`;
    insertSnippet(snippet);
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (postingRef.current) return;
    const normalizedDraft: PostDraft = {
      body: draft.body.trim(),
      ...(title ? { title: draft.title?.trim() ?? "" } : {}),
      files: draft.files,
    };
    postingRef.current = true;
    setPosting(true);
    try {
      await onSave(normalizedDraft);
      setDraft({ body: "", ...(title ? { title: "" } : {}), files: [] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      // The mutation reports the failure. Keep the draft for another attempt.
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  }

  return (
    <form onSubmit={submit} className={`space-y-3 ${className}`}>
      {replyingTo && onClearReplyTo && (
        <div className="text-xs text-neutral-400">
          <span>replying to {replyingTo.handle}</span>
          <button
            type="button"
            onClick={onClearReplyTo}
            aria-label="Clear reply"
            className="text-neutral-400 hover:text-red-400 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {title && (
        <Input
          name="title"
          value={draft.title ?? ""}
          onChange={(e) => updateDraft({ title: e.target.value })}
          placeholder={title.placeholder ?? "Title"}
          required
          maxLength={title.maxLength}
        />
      )}

      <Textarea
        ref={textareaRef}
        name="body"
        value={body}
        onChange={(e) => updateDraft({ body: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={bodyPlaceholder}
        required
        rows={bodyRows}
        maxLength={bodyMaxLength}
      />

      {files.length > 0 && (
        <FileChips
          files={files}
          onRemove={removeFile}
          onInsert={insertAttachment}
        />
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={posting}>
          {posting ? (
            "posting..."
          ) : (
            <>
              <Send size={14} className="inline -mt-0.5" /> {submitLabel}
            </>
          )}
        </Button>
        {!attachmentsAtLimit && !posting && (
          <label className="text-neutral-200 cursor-pointer bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded inline-block">
            <span className="inline-flex items-center gap-1.5">
              <Paperclip size={14} /> attach
            </span>
            <input
              ref={fileInputRef}
              name="attachments"
              type="file"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              className="hidden"
            />
          </label>
        )}
      </div>
    </form>
  );
}
