import React, { useState } from "react";
import {
  Sun,
  Moon,
  Settings as SettingsIcon,
  Sparkles,
  Brain,
  FolderOpen,
  FileText,
  Network,
} from "lucide-react";
import { AppSettings, TokenStats, VaultEntry } from "../types";
import { FolderTree } from "./FolderTree";

type NewKind = "note" | "mindmap";

interface SidebarProps {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  vaultPath: string | null;
  onPickVault: () => void;
  entries: VaultEntry[];
  activePath: string | null;
  onOpenFile: (entry: VaultEntry) => void;
  onDeleteFile: (entry: VaultEntry) => void;
  /** Topic + kind → new note or mindmap with that topic */
  onGenerate: (kind: NewKind, topic: string) => void;
  isGenerating: boolean;
  /** Total across all files */
  totalTokens: TokenStats;
  /** Tokens for the currently open file, or null if none / never generated */
  fileTokens: TokenStats | null;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  settings,
  onSettingsChange,
  vaultPath,
  onPickVault,
  entries,
  activePath,
  onOpenFile,
  onDeleteFile,
  onGenerate,
  isGenerating,
  totalTokens,
  fileTokens,
  onOpenSettings,
}) => {
  const [topic, setTopic] = useState("");
  const [genKind, setGenKind] = useState<NewKind>("mindmap");

  const toggleTheme = () => {
    onSettingsChange({
      ...settings,
      theme: settings.theme === "dark" ? "light" : "dark",
    });
  };

  const submitGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    onGenerate(genKind, t);
    setTopic("");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-content">
        {/* Top: brand + theme switch */}
        <div className="sidebar-top-row">
          <div className="sidebar-brand">
            <Brain size={16} />
            <span>MindMapper</span>
          </div>
          <button
            className="theme-icon-btn"
            onClick={toggleTheme}
            title={settings.theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
          >
            {settings.theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {/* Vault chooser */}
        <button
          className="vault-pick-btn"
          onClick={onPickVault}
          title={vaultPath ?? "Pick a vault folder"}
        >
          <FolderOpen size={14} />
          <span className="vault-pick-label">
            {vaultPath ? vaultPath.split(/[\\/]/).slice(-1)[0] : "Pick vault…"}
          </span>
        </button>

        {/* Generate (note / mindmap) */}
        {vaultPath && (
          <form className="gen-form" onSubmit={submitGenerate}>
            <div className="gen-kind-toggle">
              <button
                type="button"
                className={`gen-kind-btn${genKind === "mindmap" ? " active" : ""}`}
                onClick={() => setGenKind("mindmap")}
                title="Generate a mind map"
              >
                <Network size={12} /> Map
              </button>
              <button
                type="button"
                className={`gen-kind-btn${genKind === "note" ? " active" : ""}`}
                onClick={() => setGenKind("note")}
                title="Generate a markdown note"
              >
                <FileText size={12} /> Note
              </button>
            </div>
            <div className="gen-input-row">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={genKind === "mindmap" ? "Mind map topic…" : "Note topic…"}
                className="api-input"
                disabled={isGenerating}
              />
              <button
                type="submit"
                className="gen-submit-btn"
                disabled={isGenerating || !topic.trim()}
                title="Generate"
              >
                <Sparkles size={13} />
              </button>
            </div>
          </form>
        )}

        {/* Tree */}
        <div className="vault-tree-wrap">
          {!vaultPath ? (
            <p className="no-vault">Pick a folder above — it becomes your MindMapper vault.</p>
          ) : entries.length === 0 ? (
            <p className="no-vault">Empty vault. Generate a mind map or a note above to get started.</p>
          ) : (
            <FolderTree
              entries={entries}
              activePath={activePath}
              onOpen={onOpenFile}
              onDelete={onDeleteFile}
            />
          )}
        </div>

        {/* Token usage — only when something the AI made is open, plus total */}
        {(fileTokens || totalTokens.total > 0) && (
          <div className="token-usage-section">
            {fileTokens && (
              <div className="token-stats">
                <div className="token-stat-row label">
                  <span>This file</span>
                </div>
                <div className="token-stat-row">
                  <span>Prompt</span>
                  <span className="token-count">{fileTokens.prompt.toLocaleString()}</span>
                </div>
                <div className="token-stat-row">
                  <span>Completion</span>
                  <span className="token-count">{fileTokens.completion.toLocaleString()}</span>
                </div>
                <div className="token-stat-row total">
                  <span>Total</span>
                  <span className="token-count">{fileTokens.total.toLocaleString()}</span>
                </div>
              </div>
            )}
            {totalTokens.total > 0 && (
              <div className="token-stats">
                <div className="token-stat-row label">
                  <span>All-time</span>
                </div>
                <div className="token-stat-row">
                  <span>Prompt</span>
                  <span className="token-count">{totalTokens.prompt.toLocaleString()}</span>
                </div>
                <div className="token-stat-row">
                  <span>Completion</span>
                  <span className="token-count">{totalTokens.completion.toLocaleString()}</span>
                </div>
                <div className="token-stat-row total">
                  <span>Total</span>
                  <span className="token-count">{totalTokens.total.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom: settings modal trigger */}
        <button className="sidebar-settings-btn" onClick={onOpenSettings}>
          <SettingsIcon size={14} /> Settings
        </button>
      </div>
    </aside>
  );
};
