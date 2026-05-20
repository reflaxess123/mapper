import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface NoteEditorProps {
  /** Initial markdown content from disk. Re-supplied when the active file changes. */
  initialContent: string;
  /** Stable key (the file path) — re-mounts the editor when switched. */
  fileKey: string;
  /** Saved to disk by the caller (debounce-handled here). */
  onChange: (next: string) => void;
  /** Width of the left (editor) pane in pixels. */
  editorPaneWidth: number;
  /** Persist the slider value to settings. */
  onEditorPaneWidthChange: (next: number) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  initialContent,
  fileKey,
  onChange,
  editorPaneWidth,
  onEditorPaneWidthChange,
}) => {
  const [value, setValue] = useState(initialContent);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Hard reset when the active file changes.
  useEffect(() => {
    setValue(initialContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey]);

  // Debounced save on edits (250ms). The wrapper hands the saved value
  // upward; the actual disk write happens in App.tsx.
  useEffect(() => {
    if (value === initialContent) return;
    const t = setTimeout(() => onChange(value), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Drag-to-resize the split. We translate the global mouseX into a
  // local offset relative to the container, then clamp.
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const local = e.clientX - rect.left;
      const min = 240;
      const max = Math.max(min + 200, rect.width - 280);
      const clamped = Math.max(min, Math.min(max, local));
      onEditorPaneWidthChange(clamped);
    };
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="note-editor" ref={containerRef}>
      <div className="note-pane note-pane--editor" style={{ width: editorPaneWidth }}>
        <textarea
          className="note-textarea mono"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          placeholder="# Title

Write Markdown here. Math works via $E = mc^2$ inline and
$$
\\int_0^\\infty e^{-x^2}\\,dx = \\tfrac{\\sqrt{\\pi}}{2}
$$
display blocks."
        />
      </div>
      <div
        className="note-divider"
        onMouseDown={startDrag}
        title="Drag to resize"
      />
      <div className="note-pane note-pane--preview">
        <div className="note-preview">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {value || ""}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
