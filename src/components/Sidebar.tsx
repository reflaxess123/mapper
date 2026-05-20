import React, { useState } from "react";
import {
  Sun,
  Moon,
  Settings as SettingsIcon,
  Sparkles,
  FolderOpen,
  FileText,
  Network,
  Plus,
  ZoomIn,
  ZoomOut,
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
  onGenerate: (kind: NewKind, topic: string) => void;
  /** Create a blank .md file with a placeholder title. */
  onCreateBlankNote: () => void;
  isGenerating: boolean;
  totalTokens: TokenStats;
  fileTokens: TokenStats | null;
  onOpenSettings: () => void;
}

const SCALE_STEP = 0.1;
const SCALE_MIN = 0.7;
const SCALE_MAX = 1.6;

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
  onCreateBlankNote,
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

  const bumpScale = (delta: number) => {
    const next = Math.round((settings.uiScale + delta) * 100) / 100;
    const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, next));
    onSettingsChange({ ...settings, uiScale: clamped });
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
        {/* Top row: scale +/-, theme switch */}
        <div className="sidebar-top-row">
          <div className="scale-cluster" role="group" aria-label="UI scale">
            <button
              className="scale-btn"
              onClick={() => bumpScale(-SCALE_STEP)}
              disabled={settings.uiScale <= SCALE_MIN + 0.001}
              title="Smaller UI"
              aria-label="Smaller UI"
            >
              <ZoomOut size={13} />
            </button>
            <span className="scale-readout">{Math.round(settings.uiScale * 100)}%</span>
            <button
              className="scale-btn"
              onClick={() => bumpScale(SCALE_STEP)}
              disabled={settings.uiScale >= SCALE_MAX - 0.001}
              title="Bigger UI"
              aria-label="Bigger UI"
            >
              <ZoomIn size={13} />
            </button>
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

        {/* Vault picker chip */}
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

        {/* Generate + blank note */}
        {vaultPath && (
          <div className="gen-block">
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
            <form className="gen-input-row" onSubmit={submitGenerate}>
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
                title="Generate via AI"
              >
                <Sparkles size={13} />
              </button>
              <button
                type="button"
                className="gen-submit-btn alt"
                onClick={onCreateBlankNote}
                title="Create a blank note (no AI)"
                aria-label="New blank note"
              >
                <Plus size={14} />
              </button>
            </form>
          </div>
        )}

        {/* Tree */}
        <div className="vault-tree-wrap">
          {!vaultPath ? (
            <p className="no-vault">Pick a folder above — it becomes your MindMapper vault.</p>
          ) : entries.length === 0 ? (
            <p className="no-vault">Empty vault. Generate or create something above to get started.</p>
          ) : (
            <FolderTree
              entries={entries}
              activePath={activePath}
              onOpen={onOpenFile}
              onDelete={onDeleteFile}
            />
          )}
        </div>

        {/* Token usage — only when AI activity is relevant to the current view */}
        {(fileTokens || totalTokens.total > 0) && (
          <div className="token-usage-section">
            {fileTokens && (
              <div className="token-stats">
                <div className="token-stat-row label"><span>This file</span></div>
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
                <div className="token-stat-row label"><span>All-time</span></div>
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
