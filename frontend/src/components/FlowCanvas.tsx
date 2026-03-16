"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  Node,
  Edge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { ChevronRight, Home, Copy, Check } from "lucide-react";

import { ExecutionPath, FlowNode, FlowEdge } from "@/lib/mockData";
import { StandardNode, EnhancedNode, GhostEntryPin } from "./nodes/CustomNodes";
import { DrillEntry } from "@/app/page";

const nodeTypes = { standard: StandardNode, enhanced: EnhancedNode, ghostEntryPin: GhostEntryPin };

interface FlowCanvasProps {
  path: ExecutionPath;
  drillStack: DrillEntry[];
  sidebarOpen: boolean;
  onNodeClick: (node: FlowNode) => void;
  onNodeDrillDown: (node: FlowNode) => void;
  onBackTo: (index: number) => void;
}

function buildDagreLayout(nodes: FlowNode[], edges: FlowEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120 });
  g.setDefaultEdgeLabel(() => ({}));
  const NODE_W = 450;
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: (n.intentTag || n.docstring) ? 110 : 80 }));
  [...edges].sort((a, b) => a.callOrder - b.callOrder).forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return g;
}

function buildReactFlowEdge(e: FlowEdge): Edge {
  const color = "rgba(255, 255, 255, 0.45)";
  const glow = "rgba(255, 255, 255, 0.8)";
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
    type: "smoothstep",
    style: {
      stroke: color,
      strokeWidth: 2,
      filter: `drop-shadow(0 0 6px ${glow})`,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color,
      width: 14,
      height: 14,
    },
  };
}

/** Inner component — lives inside ReactFlowProvider so it can use useReactFlow. */
function Canvas({
  activeNodes,
  activeEdges,
  drillStack,
  endpointLabel,
  sidebarOpen,
  onNodeClick,
  onNodeDrillDown,
  onBackTo,
}: {
  activeNodes: FlowNode[];
  activeEdges: FlowEdge[];
  drillStack: DrillEntry[];
  endpointLabel: string;
  sidebarOpen: boolean;
  onNodeClick: (node: FlowNode) => void;
  onNodeDrillDown: (node: FlowNode) => void;
  onBackTo: (index: number) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView, getViewport, setViewport } = useReactFlow();
  const [copied, setCopied] = useState(false);
  const [copiedBreadcrumb, setCopiedBreadcrumb] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Reset hint whenever the viewed graph changes (new endpoint or drill level)
  useEffect(() => {
    setHasInteracted(false);
  }, [activeNodes]);

  const handleCopy = useCallback(() => {
    const text = activeNodes
      .map((n) => `${n.funcName}(${n.fileName.split("/").pop()})`)
      .join(" -> ");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [activeNodes]);

  const handleCopyBreadcrumb = useCallback(() => {
    const parts = [endpointLabel, ...drillStack.map((e) => e.label)];
    navigator.clipboard.writeText(parts.join(" > ")).then(() => {
      setCopiedBreadcrumb(true);
      setTimeout(() => setCopiedBreadcrumb(false), 1500);
    });
  }, [drillStack, endpointLabel]);

  useEffect(() => {
    const g = buildDagreLayout(activeNodes, activeEdges);
    // Filter out any degenerate edges first
    const nodeIds = new Set(activeNodes.map((n) => n.id));
    const validEdges = activeEdges.filter(
      (e) => e.source !== e.target && nodeIds.has(e.source) && nodeIds.has(e.target),
    );
    const targets = new Set(validEdges.map((e) => e.target));
    const sources = new Set(validEdges.map((e) => e.source));

    const layoutNodes: Node[] = activeNodes.map((n) => {
      const pos = g.node(n.id);
      return {
        id: n.id,
        type: n.type,
        data: { ...n, hasIncoming: targets.has(n.id), hasOutgoing: sources.has(n.id) },
        position: { x: pos.x - 225, y: pos.y - ((n.intentTag || n.docstring) ? 55 : 40) },
      };
    });

    // When nested, prepend a ghost entry pin above the topmost node
    const layoutEdges: Edge[] = validEdges.map((e) => buildReactFlowEdge(e));
    if (drillStack.length > 0) {
      const topNode = layoutNodes.reduce((a, b) => (a.position.y < b.position.y ? a : b));
      const callerLabel = drillStack[drillStack.length - 1].label;
      const pinId = "__ghost_entry_pin__";
      layoutNodes.unshift({
        id: pinId,
        type: "ghostEntryPin",
        data: { callerLabel, onBack: () => onBackTo(drillStack.length - 2) },
        position: { x: topNode.position.x, y: topNode.position.y - 120 },
        selectable: false,
        draggable: false,
      } as Node);
      layoutEdges.unshift({
        id: `${pinId}->${topNode.id}`,
        source: pinId,
        target: topNode.id,
        style: { stroke: "rgba(255,255,255,0.08)", strokeWidth: 1, strokeDasharray: "4 4" },
        animated: false,
      });
    }

    setNodes(layoutNodes);
    setEdges(layoutEdges);

    const t = setTimeout(() => fitView({ padding: 0.25, duration: 350 }), 60);
    return () => clearTimeout(t);
  }, [activeNodes, activeEdges, drillStack, setNodes, setEdges, fitView]);

  // Pan viewport left/right as the sidebar opens/closes (sidebar is 384px wide)
  const prevSidebarOpen = useRef(sidebarOpen);
  useEffect(() => {
    if (prevSidebarOpen.current === sidebarOpen) return;
    prevSidebarOpen.current = sidebarOpen;
    const vp = getViewport();
    const shift = 192; // half of sidebar width so the canvas re-centers
    setViewport({ ...vp, x: vp.x + (sidebarOpen ? -shift : shift) }, { duration: 350 });
  }, [sidebarOpen, getViewport, setViewport]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === "__ghost_entry_pin__") return;
      setHasInteracted(true);
      onNodeClick(node.data as FlowNode);
    },
    [onNodeClick],
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const flowNode = node.data as FlowNode;
      if (flowNode.hasDetail) onNodeDrillDown(flowNode);
    },
    [onNodeDrillDown],
  );

  const isDetail = drillStack.length > 0;

  return (
    <div className="w-full h-full bg-black relative flex flex-col">
      {/* Breadcrumb bar — only shown when drilling into a node */}
      <AnimatePresence>
        {isDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 40, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="flex items-center gap-1 px-4 border-b border-white/10 bg-black/50 backdrop-blur-md shrink-0 overflow-hidden z-20 justify-between"
          >
            <button
              onClick={() => onBackTo(-1)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 cursor-pointer transition-colors"
            >
              <Home className="w-3 h-3" />
              <span className="font-mono">{endpointLabel}</span>
            </button>

            {drillStack.map((entry, idx) => {
              const isLast = idx === drillStack.length - 1;
              return (
                <div key={entry.id} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-gray-700" />
                  <button
                    onClick={() => !isLast && onBackTo(idx)}
                    className={`text-xs transition-colors ${
                      isLast
                        ? "text-gray-200 cursor-default font-medium"
                        : "text-gray-500 hover:text-gray-300 cursor-pointer"
                    }`}
                  >
                    {entry.label}
                  </button>
                </div>
              );
            })}

            <button
              onClick={handleCopyBreadcrumb}
              aria-label="Copy breadcrumb path"
              className="ml-auto text-gray-600 hover:text-gray-400 active:text-gray-300 transition-colors p-1 rounded"
            >
              {copiedBreadcrumb ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flow canvas — keyed on drill depth so each level fades in cleanly */}
      <motion.div
        key={drillStack.length}
        className="flex-1 relative z-10"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          connectOnClick={false}
          zoomOnDoubleClick={false}
        >
          <Panel position="top-right" style={{ margin: "8px" }}>
            <motion.button
              onClick={handleCopy}
              aria-label="Copy flow as text"
              animate={copied ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ type: "spring", damping: 14, stiffness: 400 }}
              className={`p-1.5 rounded-md border transition-colors ${copied ? "text-green-400 border-green-500/20 bg-green-500/8" : "text-gray-600 border-white/10 bg-black/40 hover:text-gray-400 hover:border-white/20 active:bg-white/5"}`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </motion.button>
          </Panel>
          {/* Interaction hint — teaches click/double-click, dismisses on first node interaction */}
          <Panel position="bottom-center" style={{ marginBottom: "20px", pointerEvents: "none" }}>
            <AnimatePresence>
              {activeNodes.length > 0 && !hasInteracted && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 3 }}
                  transition={{ type: "spring", damping: 28, stiffness: 220, delay: 0.5 }}
                  className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/8 text-[11px] text-white/30 font-mono select-none"
                >
                  <span>click to inspect</span>
                  <span className="w-px h-3 bg-white/10" />
                  <span>double-click <span className="text-white/20">◈</span> to drill in</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Panel>
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.05)" />
          <Controls
            showInteractive={false}
            className="bg-black/60! backdrop-blur-xl! border! border-white/10! fill-gray-400 stroke-gray-400 text-gray-400 [&>button]:bg-transparent! [&>button]:border-b! [&>button]:border-white/10! [&>button:hover]:bg-white/10!"
          />
        </ReactFlow>
      </motion.div>
    </div>
  );
}

export function FlowCanvas({ path, drillStack, sidebarOpen, onNodeClick, onNodeDrillDown, onBackTo }: FlowCanvasProps) {
  const currentNodeId = drillStack.length > 0 ? drillStack[drillStack.length - 1].id : null;
  const currentDetail = currentNodeId ? path.nodeDetails[currentNodeId] ?? null : null;

  const activeNodes = currentDetail ? currentDetail.nodes : path.nodes;
  const activeEdges = currentDetail ? currentDetail.edges : path.edges;

  const endpointLabel = `${path.method} ${path.endpoint}`;

  return (
    <ReactFlowProvider>
      <Canvas
        activeNodes={activeNodes}
        activeEdges={activeEdges}
        drillStack={drillStack}
        endpointLabel={endpointLabel}
        sidebarOpen={sidebarOpen}
        onNodeClick={onNodeClick}
        onNodeDrillDown={onNodeDrillDown}
        onBackTo={onBackTo}
      />
    </ReactFlowProvider>
  );
}
