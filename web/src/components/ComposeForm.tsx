import type { SyntheticEvent } from "react";
import { Input, Textarea, Button } from "./Form";

interface ComposeFormProps {
  onSubmit: (e: SyntheticEvent) => void;
  body: string;
  onBodyChange: (value: string) => void;
  bodyPlaceholder?: string;
  bodyRows?: number;
  bodyMaxLength?: number;
  title?: string;
  onTitleChange?: (value: string) => void;
  titlePlaceholder?: string;
  titleMaxLength?: number;
  files: FileList | null;
  onFilesChange: (files: FileList | null) => void;
  quote?: { uri: string; handle: string } | null;
  onClearQuote?: () => void;
  submitLabel?: string;
  posting?: boolean;
  className?: string;
}

export default function ComposeForm({
  onSubmit,
  body,
  onBodyChange,
  bodyPlaceholder = "What's on your mind?",
  bodyRows = 4,
  title,
  onTitleChange,
  titlePlaceholder = "Title",
  files,
  onFilesChange,
  quote,
  onClearQuote,
  submitLabel = "post",
  posting = false,
  className = "",
  bodyMaxLength,
  titleMaxLength,
}: ComposeFormProps) {
  const fileNames = files?.length
    ? Array.from(files)
        .map((f) => f.name)
        .join(", ")
    : "";

  return (
    <form onSubmit={onSubmit} className={`space-y-3 ${className}`}>
      {quote && onClearQuote && (
        <div className="text-xs text-neutral-500">
          <span>quoting {quote.handle}</span>
          <button
            type="button"
            onClick={onClearQuote}
            className="text-neutral-500 hover:text-red-400 ml-2"
          >
            x
          </button>
        </div>
      )}

      {onTitleChange !== undefined && (
        <Input
          name="title"
          value={title ?? ""}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={titlePlaceholder}
          required
          maxLength={titleMaxLength}
        />
      )}

      <Textarea
        name="body"
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
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

      {fileNames && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="truncate">{fileNames}</span>
          <button
            type="button"
            onClick={() => onFilesChange(null)}
            className="text-neutral-500 hover:text-red-400 shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={posting}>
          {posting ? "posting..." : submitLabel}
        </Button>
        <label className="text-neutral-200 cursor-pointer bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded inline-block">
          attach
          <input
            name="attachments"
            type="file"
            multiple
            onChange={(e) => onFilesChange(e.target.files)}
            className="hidden"
          />
        </label>
      </div>
    </form>
  );
}
