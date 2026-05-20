import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MindMapNodeData, AppSettings, MindMapMeta } from "./types";
import { SettingsPanel } from "./components/SettingsPanel";
import { MindMapCanvas } from "./components/MindMapCanvas";
import { TitleBar } from "./components/TitleBar";
import { Sparkles, AlertTriangle, X } from "lucide-react";
import "./App.css";

const STORAGE_KEY_SETTINGS = "mindmapper_settings";
const STORAGE_KEY_TOKEN_USAGE = "mindmapper_token_usage";
const STORAGE_KEY_MAP_TOKENS = "mindmapper_map_tokens";

type TokenStats = { prompt: number; completion: number; total: number };

const EMPTY_TOKENS: TokenStats = { prompt: 0, completion: 0, total: 0 };

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
    const defaults: AppSettings = {
      apiKey: "",
      model: "google/gemini-2.5-flash",
      theme: "dark",
    };
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { ...defaults, ...parsed };
      } catch (e) {
        // use default
      }
    }
    return defaults;
  });

  const [tokenUsage, setTokenUsage] = useState<TokenStats>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_TOKEN_USAGE);
    if (stored) {
      try {
        return JSON.parse(stored) as TokenStats;
      } catch (e) {
        // use default
      }
    }
    return { ...EMPTY_TOKENS };
  });

  // Per-map token usage: { [mapId]: TokenStats }. Persisted alongside the
  // saved mind maps so reopening one shows the historical cost.
  const [mapTokens, setMapTokens] = useState<Record<string, TokenStats>>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_MAP_TOKENS);
    if (stored) {
      try {
        return JSON.parse(stored) as Record<string, TokenStats>;
      } catch (e) {
        // use default
      }
    }
    return {};
  });

  const [currentMap, setCurrentMap] = useState<MindMapNodeData | null>(null);
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);
  const [savedMaps, setSavedMaps] = useState<MindMapMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState("");

  // Save settings to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // Apply theme class to document element on change
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
  }, [settings.theme]);

  // Save token usage to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TOKEN_USAGE, JSON.stringify(tokenUsage));
  }, [tokenUsage]);

  // Save per-map tokens whenever the dict changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MAP_TOKENS, JSON.stringify(mapTokens));
  }, [mapTokens]);

  // Helper: add a delta to both global and the current-map counter
  const addTokens = (mapId: string, delta: TokenStats) => {
    setTokenUsage((prev) => ({
      prompt: prev.prompt + delta.prompt,
      completion: prev.completion + delta.completion,
      total: prev.total + delta.total,
    }));
    setMapTokens((prev) => {
      const cur = prev[mapId] ?? EMPTY_TOKENS;
      return {
        ...prev,
        [mapId]: {
          prompt: cur.prompt + delta.prompt,
          completion: cur.completion + delta.completion,
          total: cur.total + delta.total,
        },
      };
    });
  };

  // Load saved maps list on startup
  useEffect(() => {
    refreshSavedMaps();
  }, []);

  const refreshSavedMaps = async () => {
    try {
      const list = await invoke<MindMapMeta[]>("list_mindmaps");
      setSavedMaps(list);
    } catch (err: any) {
      console.error("Failed to list mind maps:", err);
    }
  };

  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  // Helper to deep clone the mind map tree
  const cloneTree = (tree: MindMapNodeData): MindMapNodeData => {
    return JSON.parse(JSON.stringify(tree));
  };

  // Save current mind map
  const saveCurrentMapState = async (updatedTree: MindMapNodeData, mapId: string) => {
    try {
      await invoke("save_mindmap", {
        id: mapId,
        data: JSON.stringify(updatedTree),
      });
      refreshSavedMaps();
    } catch (err: any) {
      setError(`Failed to save changes: ${err.message || err}`);
    }
  };

  // Generate new mind map
  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topicInput.trim()) return;

    if (!settings.apiKey.trim()) {
      setError("Please set your OpenRouter API Key in the settings panel first.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const responseStr = await invoke<string>("generate_mindmap", {
        apiKey: settings.apiKey.trim(),
        topic: topicInput.trim(),
        model: settings.model,
      });

      const responseObj = JSON.parse(responseStr);
      const parsed: MindMapNodeData = JSON.parse(responseObj.data);
      const newId = `map-${Date.now()}`;

      // Update token usage (global + per-map)
      addTokens(newId, {
        prompt: responseObj.prompt_tokens,
        completion: responseObj.completion_tokens,
        total: responseObj.total_tokens,
      });

      setCurrentMap(parsed);
      setCurrentMapId(newId);
      setTopicInput("");

      // Save it immediately
      await saveCurrentMapState(parsed, newId);
    } catch (err: any) {
      // Backend already produces user-readable messages (incl. OpenRouter
      // friendly errors). Only add the "Generation failed" prefix when the
      // error doesn't already start with a recognizable provider.
      const raw = String(err?.message || err || "");
      setError(
        raw.startsWith("OpenRouter") || raw.startsWith("Failed to")
          ? raw
          : `Generation failed: ${raw || "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Load saved mind map
  const handleLoadMap = async (id: string) => {
    setError(null);
    try {
      const dataStr = await invoke<string>("load_mindmap", { id });
      const parsed: MindMapNodeData = JSON.parse(dataStr);
      setCurrentMap(parsed);
      setCurrentMapId(id);
    } catch (err: any) {
      setError(`Failed to load mind map: ${err.message || err}`);
    }
  };

  // Delete saved mind map
  const handleDeleteMap = async (id: string) => {
    try {
      await invoke("delete_mindmap", { id });
      if (currentMapId === id) {
        setCurrentMap(null);
        setCurrentMapId(null);
      }
      // Drop the per-map counter too — total stays as-is so the
      // lifetime number doesn't shrink when the user cleans up.
      setMapTokens((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      refreshSavedMaps();
    } catch (err: any) {
      setError(`Failed to delete mind map: ${err.message || err}`);
    }
  };

  // Create new blank workspace
  const handleNewMap = () => {
    setCurrentMap(null);
    setCurrentMapId(null);
    setError(null);
    setTopicInput("");
  };

  // Toggle Collapse
  const handleToggleCollapse = (id: string) => {
    if (!currentMap || !currentMapId) return;

    const updated = cloneTree(currentMap);
    
    const toggle = (node: MindMapNodeData): boolean => {
      if (node.id === id) {
        node.isCollapsed = !node.isCollapsed;
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (toggle(child)) return true;
        }
      }
      return false;
    };

    toggle(updated);
    setCurrentMap(updated);
    saveCurrentMapState(updated, currentMapId);
  };

  // Edit Node Label
  const handleEditNode = (id: string, newName: string) => {
    if (!currentMap || !currentMapId) return;

    const updated = cloneTree(currentMap);

    const updateName = (node: MindMapNodeData): boolean => {
      if (node.id === id) {
        node.name = newName;
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (updateName(child)) return true;
        }
      }
      return false;
    };

    updateName(updated);
    setCurrentMap(updated);
    saveCurrentMapState(updated, currentMapId);
  };

  // Delete Node
  const handleDeleteNode = (id: string) => {
    if (!currentMap || !currentMapId) return;
    
    const updated = cloneTree(currentMap);

    // Root node cannot be deleted
    if (updated.id === id) {
      setError("Root node cannot be deleted.");
      return;
    }

    const removeNode = (parent: MindMapNodeData): boolean => {
      if (parent.children) {
        const index = parent.children.findIndex((child) => child.id === id);
        if (index !== -1) {
          parent.children.splice(index, 1);
          return true;
        }
        for (const child of parent.children) {
          if (removeNode(child)) return true;
        }
      }
      return false;
    };

    removeNode(updated);
    setCurrentMap(updated);
    saveCurrentMapState(updated, currentMapId);
  };

  // Add Manual Child Node
  const handleAddChildNode = (parentId: string) => {
    if (!currentMap || !currentMapId) return;

    const updated = cloneTree(currentMap);
    const newChildId = `node-${Date.now()}`;

    const addChild = (node: MindMapNodeData): boolean => {
      if (node.id === parentId) {
        if (!node.children) {
          node.children = [];
        }
        node.children.push({
          id: newChildId,
          name: "New Subtopic",
          children: [],
          isCollapsed: false,
        });
        node.isCollapsed = false; // Expand parent to show the new node
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (addChild(child)) return true;
        }
      }
      return false;
    };

    addChild(updated);
    setCurrentMap(updated);
    saveCurrentMapState(updated, currentMapId);
  };

  // Expand Node with AI (OpenRouter API)
  const handleAiExpandNode = async (nodeId: string) => {
    if (!currentMap || !currentMapId) return;

    if (!settings.apiKey.trim()) {
      setError("Please configure your OpenRouter API Key in the settings panel first.");
      return;
    }

    setGeneratingNodeId(nodeId);
    setError(null);

    const updated = cloneTree(currentMap);
    
    // Find node and its name
    let targetNodeName = "";
    const findNodeName = (node: MindMapNodeData): boolean => {
      if (node.id === nodeId) {
        targetNodeName = node.name;
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findNodeName(child)) return true;
        }
      }
      return false;
    };

    findNodeName(updated);

    if (!targetNodeName) {
      setError("Target node not found.");
      setGeneratingNodeId(null);
      return;
    }

    try {
      const responseStr = await invoke<string>("extend_node", {
        apiKey: settings.apiKey.trim(),
        topicContext: currentMap.name, // Send overall context theme (root node name)
        nodeLabel: targetNodeName,
        model: settings.model,
      });

      const responseObj = JSON.parse(responseStr);
      const newChildren: MindMapNodeData[] = JSON.parse(responseObj.data);

      // Update token usage (global + per-map)
      addTokens(currentMapId, {
        prompt: responseObj.prompt_tokens,
        completion: responseObj.completion_tokens,
        total: responseObj.total_tokens,
      });

      // Append new children to target node in tree
      const appendChildren = (node: MindMapNodeData): boolean => {
        if (node.id === nodeId) {
          if (!node.children) {
            node.children = [];
          }
          // Merge children, ensuring unique IDs and keeping existing children
          const existingIds = new Set(node.children.map(c => c.id));
          newChildren.forEach(child => {
            if (!existingIds.has(child.id)) {
              node.children.push(child);
            } else {
              // Ensure uniqueness if model duplicates IDs
              child.id = `node-${Math.random().toString(36).substr(2, 9)}`;
              node.children.push(child);
            }
          });
          node.isCollapsed = false; // Expand node to show new subtopics
          return true;
        }
        if (node.children) {
          for (const child of node.children) {
            if (appendChildren(child)) return true;
          }
        }
        return false;
      };

      appendChildren(updated);
      setCurrentMap(updated);
      await saveCurrentMapState(updated, currentMapId);
    } catch (err: any) {
      const raw = String(err?.message || err || "");
      setError(
        raw.startsWith("OpenRouter") || raw.startsWith("Failed to")
          ? raw
          : `AI expansion failed: ${raw || "Unknown error"}`,
      );
    } finally {
      setGeneratingNodeId(null);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar runs the full window height — sits left of the titlebar
          so it isn't clipped by it. */}
      <SettingsPanel
        settings={settings}
        onSettingsChange={handleSettingsChange}
        savedMaps={savedMaps}
        currentMapId={currentMapId}
        onLoadMap={handleLoadMap}
        onDeleteMap={handleDeleteMap}
        onNewMap={handleNewMap}
        tokenUsage={tokenUsage}
        currentMapTokens={currentMapId ? mapTokens[currentMapId] ?? EMPTY_TOKENS : null}
      />

      {/* Right column: titlebar above workspace */}
      <div className="main-column">
        <TitleBar />

        <div className="workspace">
          {error && (
            <div className="error-banner">
              <AlertTriangle size={18} />
              <span>{error}</span>
              <button className="error-close-btn" onClick={() => setError(null)}>
                <X size={16} />
              </button>
            </div>
          )}

          {isLoading && (
            <div className="app-loader-overlay">
              <Sparkles size={48} className="loader-sparkle" />
              <p>Generating mind map with AI...</p>
            </div>
          )}

          {currentMap ? (
            <MindMapCanvas
              data={currentMap}
              onToggleCollapse={handleToggleCollapse}
              onEdit={handleEditNode}
              onDelete={handleDeleteNode}
              onAddChild={handleAddChildNode}
              onAiExpand={handleAiExpandNode}
              generatingNodeId={generatingNodeId}
            />
          ) : (
            <div className="welcome-overlay">
              <div className="welcome-content">
                <div className="welcome-logo">
                  <img src="/icon.png" alt="MindMapper" />
                </div>
                <h1>Interactive Mind Maps</h1>
                <p>
                  Transform any concept or topic into a structured visual mind map in seconds.
                  Enter your topic below to get started. You can expand nodes with AI, add subtopics,
                  and navigate the tree interactively.
                </p>

                <form onSubmit={handleGenerate}>
                  <div className="welcome-input-group">
                    <input
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      placeholder="Enter a topic (e.g. 'Quantum Computing Basics', 'History of Art')"
                      className="welcome-input"
                      disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading} className="welcome-submit-btn">
                      <Sparkles size={18} /> Generate
                    </button>
                  </div>
                  {!settings.apiKey && (
                    <div className="welcome-warning">
                      <AlertTriangle size={14} /> Please configure your OpenRouter API Key in the left settings panel first!
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
