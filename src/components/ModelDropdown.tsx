import React from "react";
import { Cpu } from "lucide-react";

// Kept as an exported constant for any future consumer (e.g. defaults).
// The picker itself is now a free-text input — no preset menu — because
// the user wants full control over the `provider/model` slug.
export const POPULAR_MODELS = [
  { id: "google/gemini-2.5-flash",            name: "Gemini 2.5 Flash" },
  { id: "x-ai/grok-4",                        name: "Grok 4"           },
  { id: "anthropic/claude-3.5-sonnet",        name: "Claude 3.5 Sonnet" },
];

interface ModelDropdownProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export const ModelDropdown: React.FC<ModelDropdownProps> = ({
  selectedModel,
  onModelChange,
}) => {
  // Loose validity hint: any non-empty value containing a slash counts as
  // a plausible `provider/model` slug. We don't reject anything — backend
  // is the source of truth — but we badge obvious typos.
  const trimmed = selectedModel.trim();
  const looksValid = trimmed.length > 0 && trimmed.includes("/");

  return (
    <div className="model-dropdown-container">
      <div className={`model-combo${looksValid ? "" : " warn"}`}>
        <Cpu size={14} className="model-combo-icon" />
        <input
          type="text"
          className="model-combo-input"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="provider/model"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
      </div>

      {!looksValid && (
        <span className="model-hint">
          Use the <code>provider/model</code> format, e.g. <code>x-ai/grok-4</code>.
        </span>
      )}
    </div>
  );
};
