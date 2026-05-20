import React, { useState, useRef, useEffect, useMemo } from "react";
import * as d3 from "d3-hierarchy";
import { MindMapNodeData, TokenStats } from "../types";
import { MindMapNode } from "./MindMapNode";
// no toolbar — pan via middle-mouse, zoom via wheel

interface MindMapCanvasProps {
  data: MindMapNodeData;
  onToggleCollapse: (id: string) => void;
  onEdit: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  onAiExpand: (id: string) => void;
  generatingNodeId: string | null;
  /** Per-file token spend; null if this map never used the AI. */
  fileTokens?: TokenStats | null;
}

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  data,
  onToggleCollapse,
  onEdit,
  onDelete,
  onAddChild,
  onAiExpand,
  generatingNodeId,
  fileTokens,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(250);
  const [translateY, setTranslateY] = useState(300);
  const [isDragging, setIsDragging] = useState(false);

  // Set initial coordinates centered in the workspace
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTranslateX(150); // Margin on the left
      setTranslateY(rect.height / 2 - 30); // Centered vertically
    }
  }, []);

  // Zoom relative to mouse pointer (attached directly to handle passive gotchas in Chrome/Safari)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const zoomIntensity = 0.08;
      const scaleFactor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
      const newScale = Math.min(Math.max(scale * scaleFactor, 0.15), 3.0);

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Translate canvas so mouse point stays fixed
      const contentX = (mouseX - translateX) / scale;
      const contentY = (mouseY - translateY) / scale;

      setScale(newScale);
      setTranslateX(mouseX - contentX * newScale);
      setTranslateY(mouseY - contentY * newScale);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [scale, translateX, translateY]);

  // Mouse drag-to-pan using the Middle Mouse Button (wheel click, e.button === 1)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX - translateX, y: e.clientY - translateY };
      if (containerRef.current) {
        containerRef.current.style.cursor = "grabbing";
      }
    }
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setTranslateX(e.clientX - dragStart.current.x);
      setTranslateY(e.clientY - dragStart.current.y);
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        setIsDragging(false);
        if (containerRef.current) {
          containerRef.current.style.cursor = "default";
        }
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleWindowMouseMove);
      window.addEventListener("mouseup", handleWindowMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDragging]);

  // Compute Left-to-Right tree layout using d3-hierarchy.
  // Memoized so React can diff stable [x,y] pairs and the CSS `left/top`
  // transitions actually fire instead of replacing the layout every render.
  const { nodes, links } = useMemo(() => {
    const root = d3.hierarchy<MindMapNodeData>(data, (d) =>
      d.isCollapsed ? [] : d.children,
    );
    // nodeSize: [vertical spacing, horizontal spacing]
    // Cards are 184×~46. 96px vertical / 300px horizontal gives the
    // canvas air to breathe even with three siblings.
    const treeLayout = d3.tree<MindMapNodeData>().nodeSize([96, 300]);
    const pointRoot = treeLayout(root) as d3.HierarchyPointNode<MindMapNodeData>;
    return {
      nodes: pointRoot.descendants(),
      links: pointRoot.links(),
    };
  }, [data]);

  // ── Exit animation for nodes that vanished from the layout ────────────
  // d3 simply omits collapsed descendants, but we want them to fade out
  // instead of snapping. We snapshot the previous render's nodes, diff IDs
  // against the current set, and keep the missing ones around for 320ms
  // with an `exiting` class so the CSS can animate them out.
  type ExitingNode = {
    id: string;
    x: number;
    y: number;
    depth: number;
    data: MindMapNodeData;
  };
  const prevNodesRef = useRef<Map<string, ExitingNode>>(new Map());
  const [exitingNodes, setExitingNodes] = useState<ExitingNode[]>([]);

  useEffect(() => {
    const currentIds = new Set(nodes.map((n) => n.data.id));
    const stale: ExitingNode[] = [];
    prevNodesRef.current.forEach((prev) => {
      if (!currentIds.has(prev.id)) stale.push(prev);
    });

    const nextMap = new Map<string, ExitingNode>();
    nodes.forEach((n) => {
      nextMap.set(n.data.id, {
        id: n.data.id,
        x: n.x,
        y: n.y,
        depth: n.depth,
        data: n.data,
      });
    });
    prevNodesRef.current = nextMap;

    if (stale.length === 0) {
      if (exitingNodes.length > 0) setExitingNodes([]);
      return;
    }
    setExitingNodes(stale);
    const t = setTimeout(() => setExitingNodes([]), 320);
    return () => clearTimeout(t);
    // We intentionally exclude exitingNodes from deps so we don't loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // Single accent color for every link; opacity declines with depth so
  // the root → first-level branches read as strongest and the leaves
  // fade out. Black-on-black bug came from a stale CSS variable
  // (--accent-root etc.) that no longer exists in the new token set.
  const getDepthOpacity = (depth: number) => {
    if (depth === 0) return 0.95;
    if (depth === 1) return 0.75;
    if (depth === 2) return 0.55;
    return 0.4;
  };

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onMouseDown={handleMouseDown}
    >
      {/* Drawing Space with Zoom and Translate transforms */}
      <div
        ref={canvasRef}
        className="canvas-transform-layer"
        style={{
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* SVG Links Container */}
        <svg className="mindmap-svg" style={{ overflow: "visible" }}>
          {/* Draw connecting curves — single-color accent stroke whose
              opacity tapers by depth so the eye follows root → leaves. */}
          {links.map((link) => {
            const source = link.source;
            const target = link.target;
            const sourceId = source.data.id;
            const targetId = target.data.id;

            // Card is 184px wide (matches .mindmap-node)
            const cardWidth = 184;

            const startX = source.y + cardWidth;
            const startY = source.x;
            const endX = target.y;
            const endY = target.x;

            // Smooth cubic bezier curves
            const controlPoint1X = startX + (endX - startX) / 2;
            const controlPoint1Y = startY;
            const controlPoint2X = startX + (endX - startX) / 2;
            const controlPoint2Y = endY;

            const pathData = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;

            return (
              <path
                key={`link-${sourceId}-${targetId}`}
                d={pathData}
                fill="none"
                stroke="var(--accent)"
                strokeOpacity={getDepthOpacity(target.depth)}
                strokeWidth={2}
                strokeLinecap="round"
                className="link-path"
              />
            );
          })}
        </svg>

        {/* Nodes Container */}
        <div className="nodes-container" style={{ position: "absolute", top: 0, left: 0 }}>
          {nodes.map((node) => (
            <MindMapNode
              key={node.data.id}
              node={node}
              onToggleCollapse={onToggleCollapse}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onAiExpand={onAiExpand}
              generatingNodeId={generatingNodeId}
            />
          ))}
          {/* Ghost copies of nodes whose ancestor just collapsed.
              They fade + shrink toward the parent for ~320ms. */}
          {exitingNodes.map((node) => (
            <div
              key={`exit-${node.id}`}
              className={`mindmap-node exiting ${
                node.depth === 0
                  ? "glow-root"
                  : node.depth === 1
                  ? "glow-depth-1"
                  : node.depth === 2
                  ? "glow-depth-2"
                  : "glow-depth-3"
              }`}
              style={{ left: `${node.y}px`, top: `${node.x}px` }}
            >
              <div className="node-body">
                <div className="node-text-container">
                  <span className="node-text">{node.data.name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tiny floating token readout — visible only when this map has
          consumed AI calls. Bottom-right, doesn't compete with content. */}
      {fileTokens && fileTokens.total > 0 && (
        <div className="canvas-tokens" title="Tokens spent on this mind map">
          <span className="ct-pair">
            <span className="ct-key">in</span>
            <span className="ct-val">{fileTokens.prompt.toLocaleString()}</span>
          </span>
          <span className="ct-pair">
            <span className="ct-key">out</span>
            <span className="ct-val">{fileTokens.completion.toLocaleString()}</span>
          </span>
          <span className="ct-pair total">
            <span className="ct-key">Σ</span>
            <span className="ct-val">{fileTokens.total.toLocaleString()}</span>
          </span>
        </div>
      )}
    </div>
  );
};
