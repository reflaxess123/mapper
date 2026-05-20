import React, { useState } from "react";
import { AppSettings, MindMapMeta } from "../types";
import {
  Eye,
  EyeOff,
  Plus,
  FileText,
  Trash2,
  Sun,
  Moon,
} from "lucide-react";
import { ModelDropdown, POPULAR_MODELS as MODEL_LIST } from "./ModelDropdown";

export const POPULAR_MODELS = MODEL_LIST;

type TokenStats = { prompt: number; completion: number; total: number };

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  savedMaps: MindMapMeta[];
  currentMapId: string | null;
  onLoadMap: (id: string) => void;
  onDeleteMap: (id: string) => void;
  onNewMap: () => void;
  tokenUsage: TokenStats;
  currentMapTokens: TokenStats | null;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
  savedMaps,
  currentMapId,
  onLoadMap,
  onDeleteMap,
  onNewMap,
  tokenUsage,
  currentMapTokens,
}) => {
  const [showKey, setShowKey] = useState(false);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, apiKey: e.target.value });
  };

  const handleModelChange = (modelId: string) => {
    onSettingsChange({ ...settings, model: modelId });
  };

  const toggleTheme = () => {
    onSettingsChange({
      ...settings,
      theme: settings.theme === "dark" ? "light" : "dark",
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-content">
        {/* Header row: New map button + theme toggle icon */}
        <div className="sidebar-top-row">
          <button className="new-map-btn" onClick={onNewMap}>
            <Plus size={16} /> New Map
          </button>
          <button
            className="theme-icon-btn"
            onClick={toggleTheme}
            title={settings.theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
          >
            {settings.theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        <div className="settings-section">
          <div className="input-group">
            <input
              type={showKey ? "text" : "password"}
              value={settings.apiKey}
              onChange={handleApiKeyChange}
              placeholder="sk-or-v1-…  (OpenRouter API key)"
              className="api-input"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              className="toggle-visibility-btn"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? "Hide key" : "Reveal key"}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="settings-tip">
            Get a key at{" "}
            <a href="https://openrouter.ai" target="_blank" rel="noreferrer">
              openrouter.ai
            </a>
            .
          </p>
        </div>

        <div className="settings-section">
          <ModelDropdown selectedModel={settings.model} onModelChange={handleModelChange} />
        </div>

        <div className="history-section">
          {savedMaps.length === 0 ? (
            <p className="no-maps-text">No saved maps yet. Generate or create one!</p>
          ) : (
            <div className="saved-maps-list">
              {savedMaps.map((map) => (
                <div
                  key={map.id}
                  className={`saved-map-item${currentMapId === map.id ? " active" : ""}`}
                  onClick={() => onLoadMap(map.id)}
                >
                  <div className="map-info">
                    <div className="map-name">
                      <FileText size={13} /> {map.name}
                    </div>
                    <div className="map-date">{formatDate(map.modified)}</div>
                  </div>
                  <button
                    className="delete-map-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteMap(map.id);
                    }}
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="token-usage-section">
          {currentMapTokens && (
            <div className="token-stats">
              <div className="token-stat-row label">
                <span>This map</span>
              </div>
              <div className="token-stat-row">
                <span>Prompt</span>
                <span className="token-count">{currentMapTokens.prompt.toLocaleString()}</span>
              </div>
              <div className="token-stat-row">
                <span>Completion</span>
                <span className="token-count">{currentMapTokens.completion.toLocaleString()}</span>
              </div>
              <div className="token-stat-row total">
                <span>Total</span>
                <span className="token-count">{currentMapTokens.total.toLocaleString()}</span>
              </div>
            </div>
          )}
          <div className="token-stats">
            <div className="token-stat-row label">
              <span>All-time</span>
            </div>
            <div className="token-stat-row">
              <span>Prompt</span>
              <span className="token-count">{tokenUsage.prompt.toLocaleString()}</span>
            </div>
            <div className="token-stat-row">
              <span>Completion</span>
              <span className="token-count">{tokenUsage.completion.toLocaleString()}</span>
            </div>
            <div className="token-stat-row total">
              <span>Total</span>
              <span className="token-count">{tokenUsage.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
