import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Eye, Pencil, Wand2 } from "lucide-react";
import "katex/dist/katex.min.css";
import { NoteViewMode } from "../types";

interface NoteEditorProps {
  /** File name without extension — shown as the title in the header. */
  title: string;
  /** Initial markdown content from disk. Re-supplied when the active file changes. */
  initialContent: string;
  /** Stable key (the file path) — re-mounts the editor when switched. */
  fileKey: string;
  /** Saved to disk by the caller (debounced inside). */
  onChange: (next: string) => void;
  /** Top-right toggle persists to settings. */
  mode: NoteViewMode;
  onModeChange: (mode: NoteViewMode) => void;
  /** Trigger AI title-generation. Caller renames the file + refreshes tree. */
  onGenerateTitle: (currentContent: string) => void;
  /** Disable the title-AI button (no API key, or already running). */
  titleBusy?: boolean;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  title,
  initialContent,
  fileKey,
  onChange,
  mode,
  onModeChange,
  onGenerateTitle,
  titleBusy,
}) => {
  const [value, setValue] = useState(initialContent);

  // Hard reset when the active file changes.
  useEffect(() => {
    setValue(initialContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey]);

  // Debounced save on edits (250ms).
  useEffect(() => {
    if (value === initialContent) return;
    const t = setTimeout(() => onChange(value), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="note-view">
      <header className="note-header">
        <div className="note-title" title={title}>{title}</div>
        <div className="note-header-actions">
          <button
            type="button"
            className="note-icon-btn"
            onClick={() => onGenerateTitle(value)}
            disabled={!!titleBusy}
            title="Generate title from content"
            aria-label="Generate title"
          >
            <Wand2 size={14} />
          </button>
          <button
            type="button"
            className={`note-mode-toggle${mode === "view" ? " active" : ""}`}
            onClick={() => onModeChange(mode === "edit" ? "view" : "edit")}
            title={mode === "edit" ? "Switch to preview" : "Switch to editor"}
            aria-label="Toggle edit/view"
          >
            {mode === "edit" ? <Eye size={14} /> : <Pencil size={14} />}
          </button>
        </div>
      </header>

      <div className="note-body">
        {mode === "edit" ? (
          <textarea
            className="note-textarea mono"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            placeholder={
`# Title

Write Markdown here. Math works via $E = mc^2$ inline and
$$
\\int_0^\\infty e^{-x^2}\\,dx = \\tfrac{\\sqrt{\\pi}}{2}
$$
display blocks.`
            }
          />
        ) : (
          <div className="note-preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {value || ""}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
