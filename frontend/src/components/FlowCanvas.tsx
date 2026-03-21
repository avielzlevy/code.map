"use client";

import { useEffect, useCallback, useState, useRef, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ReactFlow,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  Node,
  Edge,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { ChevronRight, ChevronDown, Home, Copy, Check } from "lucide-react";
import { Tooltip } from "./Tooltip";

import { ExecutionPath, FlowNode, FlowEdge, GitInfo } from "@/lib/flow-types";
import { StandardNode, EnhancedNode, GhostEntryPin } from "./nodes/CustomNodes";
import { DrillEntry } from "@/app/app/page";
import { SPRING_DEFAULT, SPRING_BOUNCE } from "@/lib/spring";

const nodeTypes = { standard: StandardNode, enhanced: EnhancedNode, ghostEntryPin: GhostEntryPin };

interface FlowCanvasProps {
  path: ExecutionPath;
  drillStack: DrillEntry[];
  onNodeDrillDown: (node: FlowNode) => void;
  onBackTo: (index: number) => void;
  guideNodeId?: string | null;
  gitInfo?: GitInfo | null;
}

const NODE_W = 450;

/** Mirror the actual rendered node height so dagre spacing is accurate.
 *  Base ~96px + intentTag row ~26px + docstring row ~32px */
function nodeHeight(n: FlowNode): number {
  let h = 96;
  if (n.intentTag) h += 26;
  if (n.docstring) h += 32;
  return h;
}

function buildDagreLayout(nodes: FlowNode[], edges: FlowEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 120 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: nodeHeight(n) }));
  [...edges].sort((a, b) => a.callOrder - b.callOrder).forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return g;
}

const EDGE_COLOR_REST = "rgba(255, 255, 255, 0.22)";
const EDGE_COLOR_ACTIVE = "rgba(255, 255, 255, 0.75)";
const EDGE_COLOR_DIM = "rgba(255, 255, 255, 0.08)";

function buildReactFlowEdge(e: FlowEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    style: {
      stroke: EDGE_COLOR_REST,
      strokeWidth: 1.5,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: EDGE_COLOR_REST,
      width: 14,
      height: 14,
    },
  };
}

/** Inner component — lives inside ReactFlowProvider so it can use useReactFlow. */
function Canvas({
  activeNodes,
  activeEdges,
  rootNodes,
  drillStack,
  endpointLabel,
  containerRef,
  onNodeDrillDown,
  onBackTo,
  guideNodeId,
  gitInfo,
}: {
  activeNodes: FlowNode[];
  activeEdges: FlowEdge[];
  rootNodes: FlowNode[];
  drillStack: DrillEntry[];
  endpointLabel: string;
  containerRef: RefObject<HTMLDivElement | null>;
  onNodeDrillDown: (node: FlowNode) => void;
  onBackTo: (index: number) => void;
  guideNodeId?: string | null;
  gitInfo?: GitInfo | null;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const [copied, setCopied] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [copiedBreadcrumb, setCopiedBreadcrumb] = useState(false);
  const [isDrilling, setIsDrilling] = useState(false);
  // Track drill direction: +1 = going deeper, -1 = going back
  const prevDrillDepthRef = useRef(drillStack.length);
  const drillEnterX = drillStack.length >= prevDrillDepthRef.current ? 30 : -30;
  prevDrillDepthRef.current = drillStack.length;

  // Which node is currently expanded (in-place detail panel)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  // Stable ref so layout effect can capture latest onNodeDrillDown without re-running
  const onNodeDrillDownRef = useRef(onNodeDrillDown);
  onNodeDrillDownRef.current = onNodeDrillDown;

  // Keyboard navigation
  const [kbFocusNodeId, setKbFocusNodeId] = useState<string | null>(null);
  const [kbHintVisible, setKbHintVisible] = useState(false);
  const kbFocusNodeIdRef = useRef<string | null>(null);
  kbFocusNodeIdRef.current = kbFocusNodeId;
  const expandedNodeIdRef = useRef<string | null>(null);
  expandedNodeIdRef.current = expandedNodeId;
  const activeNodesRef = useRef(activeNodes);
  activeNodesRef.current = activeNodes;
  const kbHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kbHintShownRef = useRef(false);

  // Sync isExpanded flag + dimming style whenever expandedNodeId changes
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, isExpanded: n.id === expandedNodeId },
        style: {
          overflow: "visible" as const,
          opacity: expandedNodeId && n.id !== expandedNodeId ? 0.3 : 1,
          transition: "opacity 200ms ease",
          zIndex: n.id === expandedNodeId ? 10 : 0,
        },
      })),
    );
  }, [expandedNodeId, setNodes]);

  const writeToClipboard = useCallback((text: string, onSuccess: () => void) => {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
      // Fallback for HTTP (non-secure) contexts or denied permissions
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        onSuccess();
      } catch {
        // Silent fail — clipboard unavailable
      }
    });
  }, []);

  const formatNodes = useCallback(
    (ns: FlowNode[]) =>
      ns.map((n) => `${n.funcName}(${n.fileName.split("/").pop() ?? n.fileName})`).join(" → "),
    [],
  );

  const handleCopyFull = useCallback(() => {
    writeToClipboard(formatNodes(rootNodes), () => {
      setCopied(true);
      setCopyMenuOpen(false);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [rootNodes, formatNodes, writeToClipboard]);

  const handleCopyCurrent = useCallback(() => {
    writeToClipboard(formatNodes(activeNodes), () => {
      setCopied(true);
      setCopyMenuOpen(false);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [activeNodes, formatNodes, writeToClipboard]);

  const handleCopyBreadcrumb = useCallback(() => {
    const parts = [endpointLabel, ...drillStack.map((e) => e.label)];
    writeToClipboard(parts.join(" > "), () => {
      setCopiedBreadcrumb(true);
      setTimeout(() => setCopiedBreadcrumb(false), 1500);
    });
  }, [drillStack, endpointLabel, writeToClipboard]);

  useEffect(() => {
    const g = buildDagreLayout(activeNodes, activeEdges);
    // Filter out any degenerate edges first
    const nodeIds = new Set(activeNodes.map((n) => n.id));
    const validEdges = activeEdges.filter(
      (e) => e.source !== e.target && nodeIds.has(e.source) && nodeIds.has(e.target),
    );
    const targets = new Set(validEdges.map((e) => e.target));
    const sources = new Set(validEdges.map((e) => e.source));

    setExpandedNodeId(null); // reset expansion on path/drill change
    setKbFocusNodeId(null);  // reset keyboard focus on path/drill change
    kbHintShownRef.current = false;

    const layoutNodes: Node[] = activeNodes.map((n) => {
      const pos = g.node(n.id);
      return {
        id: n.id,
        type: n.type,
        data: {
          ...n,
          hasIncoming: targets.has(n.id),
          hasOutgoing: sources.has(n.id),
          isExpanded: false,
          isGuideActive: false, // updated separately to avoid re-layout
          isKeyboardFocused: false,
          gitInfo: gitInfo ?? null,
          onToggleExpand: () => setExpandedNodeId((prev) => (prev === n.id ? null : n.id)),
          onDrillDown: () => onNodeDrillDownRef.current(n),
        },
        position: { x: pos.x - NODE_W / 2, y: pos.y - nodeHeight(n) / 2 },
        style: { overflow: "visible" as const },
      };
    });

    // When nested, prepend a ghost entry pin above the topmost node
    const layoutEdges: Edge[] = validEdges.map((e) => buildReactFlowEdge(e));
    if (drillStack.length > 0) {
      const leftmostNode = layoutNodes.reduce((a, b) => (a.position.x < b.position.x ? a : b));
      // Use dagre's center Y for the leftmost node so the connecting edge is horizontal
      const leftmostDagre = g.node(leftmostNode.id);
      const GHOST_PIN_H = 30;
      const callerEntry = drillStack[drillStack.length - 1];
      const callerLabel = callerEntry.label;
      const callerFile = callerEntry.fileName.split("/").pop() ?? callerEntry.fileName;
      const pinId = "__ghost_entry_pin__";
      layoutNodes.unshift({
        id: pinId,
        type: "ghostEntryPin",
        data: { callerLabel, callerFile, onBack: () => onBackTo(drillStack.length - 2) },
        position: { x: leftmostNode.position.x - 200, y: leftmostDagre.y - GHOST_PIN_H / 2 },
        selectable: false,
        draggable: false,
      } as Node);
      layoutEdges.unshift({
        id: `${pinId}->${leftmostNode.id}`,
        source: pinId,
        target: leftmostNode.id,
        style: { stroke: "rgba(255,255,255,0.08)", strokeWidth: 1, strokeDasharray: "4 4" },
        animated: false,
      });
    }

    setNodes(layoutNodes);
    setEdges(layoutEdges);

    const t = setTimeout(() => fitView({ padding: 0.25 }), 60);
    return () => clearTimeout(t);
  }, [activeNodes, activeEdges, drillStack, setNodes, setEdges, fitView]);

  // Sync isGuideActive highlight without triggering a re-layout or fitView
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, isGuideActive: guideNodeId ? n.id === guideNodeId : false },
        style: {
          ...n.style,
          zIndex: guideNodeId && n.id === guideNodeId ? 10 : 0,
        },
      })),
    );
  }, [guideNodeId, setNodes]);

  // Auto-expand the currently guided node; collapse when guide exits
  useEffect(() => {
    if (guideNodeId !== undefined) {
      setExpandedNodeId(guideNodeId ?? null);
    }
  }, [guideNodeId]);

  // Sync gitInfo into node data when it loads (without triggering a full re-layout)
  useEffect(() => {
    if (!gitInfo) return;
    setNodes((prev) =>
      prev.map((n) => ({ ...n, data: { ...n.data, gitInfo } })),
    );
  }, [gitInfo, setNodes]);

  // Sync isKeyboardFocused flag onto nodes
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, isKeyboardFocused: n.id === kbFocusNodeId },
      })),
    );
  }, [kbFocusNodeId, setNodes]);

  // Animate canvas to the keyboard-focused node
  useEffect(() => {
    if (!kbFocusNodeId) return;
    const t = setTimeout(() => {
      fitView({ nodes: [{ id: kbFocusNodeId }], padding: 0.4 });
    }, 40);
    return () => clearTimeout(t);
  }, [kbFocusNodeId, fitView]);

  // Keyboard navigation — ←/→ move focus, Enter expand, D drill, Escape dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't steal keys when guide is running
      if (guideNodeId != null) return;
      // Don't steal keys from inputs or open dialogs (e.g. command palette)
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;
      if (document.querySelector('[role="dialog"]')) return;

      const navNodes = activeNodesRef.current;
      const currentId = kbFocusNodeIdRef.current;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const idx = navNodes.findIndex((n) => n.id === currentId);
        const nextIdx = idx === -1 ? 0 : Math.min(idx + 1, navNodes.length - 1);
        setKbFocusNodeId(navNodes[nextIdx]?.id ?? null);
        // Show one-time hint
        if (!kbHintShownRef.current) {
          kbHintShownRef.current = true;
          setKbHintVisible(true);
          if (kbHintTimerRef.current) clearTimeout(kbHintTimerRef.current);
          kbHintTimerRef.current = setTimeout(() => setKbHintVisible(false), 2500);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const idx = navNodes.findIndex((n) => n.id === currentId);
        const nextIdx = idx === -1 ? 0 : Math.max(idx - 1, 0);
        setKbFocusNodeId(navNodes[nextIdx]?.id ?? null);
        if (!kbHintShownRef.current) {
          kbHintShownRef.current = true;
          setKbHintVisible(true);
          if (kbHintTimerRef.current) clearTimeout(kbHintTimerRef.current);
          kbHintTimerRef.current = setTimeout(() => setKbHintVisible(false), 2500);
        }
      } else if (e.key === "Enter") {
        const focusId = kbFocusNodeIdRef.current;
        if (focusId) setExpandedNodeId((prev) => (prev === focusId ? null : focusId));
      } else if (e.key === "d" || e.key === "D") {
        const focusId = kbFocusNodeIdRef.current;
        if (focusId) {
          const node = activeNodesRef.current.find((n) => n.id === focusId);
          if (node?.hasDetail) onNodeDrillDownRef.current(node);
        }
      } else if (e.key === "Escape") {
        if (expandedNodeIdRef.current) {
          setExpandedNodeId(null);
        } else {
          setKbFocusNodeId(null);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [guideNodeId]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id === "__ghost_entry_pin__") return;
      setExpandedNodeId((prev) => (prev === node.id ? null : node.id));
      setKbFocusNodeId(node.id);
    },
    [],
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const flowNode = node.data as FlowNode;
      if (!flowNode.hasDetail) return;
      // Brief dim confirms the action, then drill
      setIsDrilling(true);
      setTimeout(() => {
        setIsDrilling(false);
        onNodeDrillDown(flowNode);
      }, 130);
    },
    [onNodeDrillDown],
  );

  const handleNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === "__ghost_entry_pin__") return;
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: {
            ...e.style,
            stroke: e.source === node.id || e.target === node.id ? EDGE_COLOR_ACTIVE : EDGE_COLOR_DIM,
          },
        })) as Edge[],
      );
    },
    [setEdges],
  );

  const handleNodeMouseLeave = useCallback(() => {
    setEdges((eds) =>
      eds.map((e) => ({ ...e, style: { ...e.style, stroke: EDGE_COLOR_REST } })) as Edge[],
    );
  }, [setEdges]);

  const handlePaneClick = useCallback(() => {
    setExpandedNodeId(null);
  }, []);

  const isDetail = drillStack.length > 0;

  return (
    <div ref={containerRef} data-guide="flow-canvas" className="w-full h-full bg-black relative flex flex-col">
      {/* Breadcrumb bar — only shown when drilling into a node */}
      <AnimatePresence>
        {isDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 40, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING_DEFAULT}
            className="flex items-center gap-2 px-4 border-b border-white/10 bg-black/95 shrink-0 overflow-hidden z-20"
          >
            {/* Scrollable breadcrumb trail — constrained so the copy button never gets pushed off */}
            <div className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-hide">
              <Tooltip content={endpointLabel} side="bottom">
              <button
                onClick={() => onBackTo(-1)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 cursor-pointer transition-colors shrink-0 max-w-40"
              >
                <Home className="w-3 h-3 shrink-0" />
                <span className="font-mono truncate">{endpointLabel}</span>
              </button>
            </Tooltip>

              {drillStack.map((entry, idx) => {
                const isLast = idx === drillStack.length - 1;
                return (
                  <motion.div
                    key={entry.id}
                    className="flex items-center gap-1 shrink-0"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={SPRING_DEFAULT}
                  >
                    <ChevronRight className="w-3 h-3 text-gray-600" />
                    <button
                      onClick={() => !isLast && onBackTo(idx)}
                      title={entry.label}
                      className={`text-xs transition-colors truncate max-w-36 ${
                        isLast
                          ? "text-gray-200 cursor-default font-medium"
                          : "text-gray-400 hover:text-gray-200 cursor-pointer"
                      }`}
                    >
                      {entry.label}
                    </button>
                  </motion.div>
                );
              })}
            </div>

            <Tooltip content={copiedBreadcrumb ? "Copied!" : "Copy path"} side="bottom">
              <button
                onClick={handleCopyBreadcrumb}
                aria-label="Copy breadcrumb path"
                className="shrink-0 text-gray-400 hover:text-gray-200 active:text-gray-100 transition-colors p-1 rounded border border-transparent hover:border-white/10 hover:bg-white/5"
              >
                {copiedBreadcrumb ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
              </button>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard nav hint — appears once on first ←/→ press, auto-hides */}
      <AnimatePresence>
        {kbHintVisible && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={SPRING_DEFAULT}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-black/80 backdrop-blur-sm pointer-events-none"
          >
            <span className="text-[10px] font-mono text-white/35">← → navigate</span>
            <span className="text-white/15 text-[10px]">·</span>
            <span className="text-[10px] font-mono text-white/35">Enter expand</span>
            <span className="text-white/15 text-[10px]">·</span>
            <span className="text-[10px] font-mono text-white/35">D drill</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flow canvas — keyed on current node id so re-visiting a depth always remounts */}
      <motion.div
        key={drillStack.at(-1)?.id ?? "root"}
        className="flex-1 relative z-10"
        initial={{ opacity: 0, x: drillEnterX }}
        animate={{ opacity: isDrilling ? 0.6 : 1, x: 0 }}
        transition={SPRING_DEFAULT}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onPaneClick={handlePaneClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          connectOnClick={false}
          zoomOnDoubleClick={false}
        >
          <Panel position="top-right" style={{ margin: "8px" }}>
            <div className="relative">
              {copyMenuOpen && (
                <div className="fixed inset-0 z-10" onClick={() => setCopyMenuOpen(false)} />
              )}
              <motion.button
                onClick={() => setCopyMenuOpen((o) => !o)}
                aria-label="Copy flow"
                animate={copied ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                transition={SPRING_BOUNCE}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md border transition-colors ${
                  copied
                    ? "text-white border-white/20 bg-white/8"
                    : "text-gray-500 border-white/10 bg-black/40 hover:text-gray-300 hover:border-white/20 active:bg-white/5"
                }`}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <ChevronDown
                  size={10}
                  className={`transition-transform duration-150 ${copyMenuOpen ? "rotate-180" : ""}`}
                />
              </motion.button>
              {copyMenuOpen && (
                <div className="absolute top-full right-0 mt-1 z-20 bg-zinc-950 border border-white/12 rounded-lg overflow-hidden shadow-xl shadow-black/60 min-w-[130px]">
                  <button
                    onClick={handleCopyFull}
                    className="w-full text-left px-3 py-2 text-[11px] font-mono text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Full path
                  </button>
                  <button
                    onClick={handleCopyCurrent}
                    className="w-full text-left px-3 py-2 text-[11px] font-mono text-gray-400 hover:text-white hover:bg-white/5 border-t border-white/6 transition-colors"
                  >
                    Current view
                  </button>
                </div>
              )}
            </div>
          </Panel>
          <Controls showInteractive={false} />
        </ReactFlow>
      </motion.div>
    </div>
  );
}

/** DFS walk of every drill level, preserving call order within each level. */
function collectAllNodes(
  nodes: FlowNode[],
  nodeDetails: Record<string, { nodes: FlowNode[] }>,
  visited = new Set<string>(),
): FlowNode[] {
  const result: FlowNode[] = [];
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    result.push(node);
    if (node.hasDetail && nodeDetails[node.id]) {
      result.push(...collectAllNodes(nodeDetails[node.id].nodes, nodeDetails, visited));
    }
  }
  return result;
}

export function FlowCanvas({ path, drillStack, onNodeDrillDown, onBackTo, guideNodeId, gitInfo }: FlowCanvasProps) {
  const currentNodeId = drillStack.length > 0 ? drillStack[drillStack.length - 1].id : null;
  const currentDetail = currentNodeId ? path.nodeDetails[currentNodeId] ?? null : null;

  const activeNodes = currentDetail ? currentDetail.nodes : path.nodes;
  const activeEdges = currentDetail ? currentDetail.edges : path.edges;
  const fullNodes = collectAllNodes(path.nodes, path.nodeDetails);

  const endpointLabel = `${path.method} ${path.endpoint}`;
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <ReactFlowProvider>
      <Canvas
        activeNodes={activeNodes}
        activeEdges={activeEdges}
        rootNodes={fullNodes}
        drillStack={drillStack}
        endpointLabel={endpointLabel}
        containerRef={containerRef}
        onNodeDrillDown={onNodeDrillDown}
        onBackTo={onBackTo}
        guideNodeId={guideNodeId}
        gitInfo={gitInfo}
      />
    </ReactFlowProvider>
  );
}
