import React, { useState, useRef, useEffect } from "react";
import { MindMapNodeData } from "../types";
import { Sparkles, Plus, Trash2, Edit2, Check } from "lucide-react";

interface MindMapNodeProps {
  node: {
    x: number;
    y: number;
    depth: number;
    data: MindMapNodeData;
  };
  onToggleCollapse: (id: string) => void;
  onEdit: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  onAiExpand: (id: string) => void;
  generatingNodeId: string | null;
}

export const MindMapNode: React.FC<MindMapNodeProps> = ({
  node,
  onToggleCollapse,
  onEdit,
  onDelete,
  onAddChild,
  onAiExpand,
  generatingNodeId,
}) => {
  const { data, depth } = node;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const isGenerating = generatingNodeId === data.id;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim() && editValue.trim() !== data.name) {
      onEdit(data.id, editValue.trim());
    } else {
      setEditValue(data.name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(data.name);
      setIsEditing(false);
    }
  };

  const getGlowColorClass = (d: number) => {
    if (d === 0) return "glow-root";
    if (d === 1) return "glow-depth-1";
    if (d === 2) return "glow-depth-2";
    return "glow-depth-3";
  };

  const hasChildren = data.children && data.children.length > 0;
  const isCollapsed = data.isCollapsed;

  return (
    <div
      className={`mindmap-node ${getGlowColorClass(depth)}${
        isEditing ? " editing" : ""
      }${isGenerating ? " generating" : ""}`}
      style={{
        left: `${node.y}px`,
        top: `${node.x}px`,
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onToggleCollapse(data.id);
      }}
    >
      <div className="node-body">
        {isEditing ? (
          <div className="node-edit-container">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="node-input"
            />
            <button className="edit-btn save" onClick={handleSave} aria-label="Save">
              <Check size={12} />
            </button>
          </div>
        ) : (
          <div className="node-text-container">
            <span className="node-text">{data.name}</span>
            {isCollapsed && hasChildren && (
              <span
                className="collapsed-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(data.id);
                }}
                title={`${data.children.length} hidden`}
              >
                +{data.children.length}
              </span>
            )}
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="node-actions">
          <button
            className={`action-btn ai-expand${isGenerating ? " spinning" : ""}`}
            onClick={() => onAiExpand(data.id)}
            disabled={generatingNodeId !== null}
            title="Expand with AI"
            aria-label="Expand with AI"
          >
            <Sparkles size={13} />
          </button>

          <button
            className="action-btn add-child"
            onClick={() => onAddChild(data.id)}
            title="Add child node"
            aria-label="Add child node"
          >
            <Plus size={13} />
          </button>

          <button
            className="action-btn edit-label"
            onClick={() => setIsEditing(true)}
            title="Rename"
            aria-label="Rename"
          >
            <Edit2 size={13} />
          </button>

          {depth > 0 && (
            <button
              className="action-btn delete-node"
              onClick={() => onDelete(data.id)}
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}

      {isGenerating && <div className="node-loader" />}
    </div>
  );
};
