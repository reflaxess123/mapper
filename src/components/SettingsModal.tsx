import React, { useState } from "react";
import { Eye, EyeOff, X, FolderOpen, Cpu, Key, Cloud } from "lucide-react";
import { AppSettings } from "../types";

interface SettingsModalProps {
  settings: AppSettings;
  vaultPath: string | null;
  onChange: (next: AppSettings) => void;
  onClose: () => void;
  onPickVault: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  vaultPath,
  onChange,
  onClose,
  onPickVault,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [showS3Secret, setShowS3Secret] = useState(false);

  const setS3 = (patch: Partial<AppSettings["s3"]>) => {
    onChange({ ...settings, s3: { ...settings.s3, ...patch } });
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Vault */}
          <section className="modal-section">
            <h3>
              <FolderOpen size={14} /> Vault folder
            </h3>
            <div className="modal-row">
              <code className="modal-path" title={vaultPath ?? ""}>
                {vaultPath ?? "No vault selected"}
              </code>
              <button className="modal-btn" onClick={onPickVault}>
                Change…
              </button>
            </div>
          </section>

          {/* OpenRouter */}
          <section className="modal-section">
            <h3>
              <Key size={14} /> OpenRouter API key
            </h3>
            <div className="input-group">
              <input
                className="api-input"
                type={showKey ? "text" : "password"}
                value={settings.apiKey}
                onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
                placeholder="sk-or-v1-…"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="toggle-visibility-btn"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? "Hide" : "Reveal"}
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
          </section>

          {/* Model */}
          <section className="modal-section">
            <h3>
              <Cpu size={14} /> AI model
            </h3>
            <div className="model-combo">
              <Cpu size={14} className="model-combo-icon" />
              <input
                type="text"
                className="model-combo-input"
                value={settings.model}
                onChange={(e) => onChange({ ...settings, model: e.target.value })}
                placeholder="provider/model"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <p className="settings-tip">
              Free-form OpenRouter slug, e.g. <code>x-ai/grok-4</code>,{" "}
              <code>anthropic/claude-3.5-sonnet</code>.
            </p>
          </section>

          {/* S3 sync (skeleton — actual sync lands in next phase) */}
          <section className="modal-section">
            <h3>
              <Cloud size={14} /> S3 sync
              <span className="phase-badge">soon</span>
            </h3>
            <div className="grid-2">
              <label className="field">
                <span className="ftitle">Endpoint</span>
                <input
                  className="api-input mono"
                  value={settings.s3.endpoint}
                  onChange={(e) => setS3({ endpoint: e.target.value })}
                  placeholder="https://s3.amazonaws.com"
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span className="ftitle">Region</span>
                <input
                  className="api-input mono"
                  value={settings.s3.region}
                  onChange={(e) => setS3({ region: e.target.value })}
                  placeholder="us-east-1"
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span className="ftitle">Bucket</span>
                <input
                  className="api-input mono"
                  value={settings.s3.bucket}
                  onChange={(e) => setS3({ bucket: e.target.value })}
                  placeholder="mindmapper-vault"
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span className="ftitle">Prefix (optional)</span>
                <input
                  className="api-input mono"
                  value={settings.s3.prefix ?? ""}
                  onChange={(e) => setS3({ prefix: e.target.value })}
                  placeholder="vault/"
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span className="ftitle">Access key ID</span>
                <input
                  className="api-input mono"
                  value={settings.s3.accessKeyId}
                  onChange={(e) => setS3({ accessKeyId: e.target.value })}
                  placeholder="AKIA…"
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span className="ftitle">Secret access key</span>
                <div className="input-group">
                  <input
                    className="api-input mono"
                    type={showS3Secret ? "text" : "password"}
                    value={settings.s3.secretAccessKey}
                    onChange={(e) => setS3({ secretAccessKey: e.target.value })}
                    placeholder="••••••••"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="toggle-visibility-btn"
                    onClick={() => setShowS3Secret(!showS3Secret)}
                    aria-label={showS3Secret ? "Hide" : "Reveal"}
                  >
                    {showS3Secret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </label>
            </div>
            <p className="settings-tip">
              Smart sync (diff-based push/pull) will land in the next update;
              settings are stored now so you can fill them in early.
            </p>
          </section>
        </div>

        <div className="modal-footer">
          <button className="modal-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
