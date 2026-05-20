import React, { useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Network,
  File as FileIcon,
  Trash2,
} from "lucide-react";
import { VaultEntry } from "../types";

interface FolderTreeProps {
  entries: VaultEntry[];
  activePath: string | null;
  onOpen: (entry: VaultEntry) => void;
  onDelete: (entry: VaultEntry) => void;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  entries,
  activePath,
  onOpen,
  onDelete,
}) => {
  return (
    <div className="vault-tree">
      {entries.map((e) => (
        <TreeRow
          key={e.path}
          entry={e}
          depth={0}
          activePath={activePath}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

interface TreeRowProps {
  entry: VaultEntry;
  depth: number;
  activePath: string | null;
  onOpen: (entry: VaultEntry) => void;
  onDelete: (entry: VaultEntry) => void;
}

const TreeRow: React.FC<TreeRowProps> = ({
  entry,
  depth,
  activePath,
  onOpen,
  onDelete,
}) => {
  // Dot-folders (.mindmapper) start collapsed so the user's actual notes
  // dominate the tree view.
  const startsCollapsed = entry.name.startsWith(".");
  const [open, setOpen] = useState(!startsCollapsed);
  const isActive = activePath === entry.path && entry.kind !== "dir";

  const handleClick = () => {
    if (entry.kind === "dir") {
      setOpen((v) => !v);
    } else {
      onOpen(entry);
    }
  };

  const icon = (() => {
    if (entry.kind === "dir") {
      return open ? <FolderOpen size={14} /> : <Folder size={14} />;
    }
    if (entry.kind === "md") return <FileText size={14} className="ic-md" />;
    if (entry.kind === "mindmap") return <Network size={14} className="ic-mindmap" />;
    return <FileIcon size={14} className="ic-other" />;
  })();

  return (
    <>
      <div
        className={`tree-row${isActive ? " active" : ""}${
          entry.name.startsWith(".") ? " dotted" : ""
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={handleClick}
        onDoubleClick={(e) => {
          // Double-click on a directory toggles it (already does on single-
          // click). Stop propagation so the parent click doesn't fire.
          e.stopPropagation();
        }}
      >
        {entry.kind === "dir" && (
          <ChevronRight
            size={12}
            className={`tree-chev${open ? " open" : ""}`}
          />
        )}
        {entry.kind !== "dir" && <span className="tree-chev-spacer" />}
        <span className="tree-icon">{icon}</span>
        <span className="tree-name">{entry.name}</span>
        {entry.kind !== "dir" && (
          <button
            className="tree-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(entry);
            }}
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {entry.kind === "dir" && open && entry.children && entry.children.length > 0 && (
        <>
          {entry.children.map((child) => (
            <TreeRow
              key={child.path}
              entry={child}
              depth={depth + 1}
              activePath={activePath}
              onOpen={onOpen}
              onDelete={onDelete}
            />
          ))}
        </>
      )}
    </>
  );
};
