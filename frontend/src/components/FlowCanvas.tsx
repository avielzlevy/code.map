"use client";

import { useEffect, useCallback, useState, useRef, RefObject } from "react";
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
  onNodeClick: (node: FlowNode, screenX: number, screenY: number) => void;
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
  drillStack,
  endpointLabel,
  containerRef,
  onNodeClick,
  onNodeDrillDown,
  onBackTo,
}: {
  activeNodes: FlowNode[];
  activeEdges: FlowEdge[];
  drillStack: DrillEntry[];
  endpointLabel: string;
  containerRef: RefObject<HTMLDivElement | null>;
  onNodeClick: (node: FlowNode, screenX: number, screenY: number) => void;
  onNodeDrillDown: (node: FlowNode) => void;
  onBackTo: (index: number) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const [copied, setCopied] = useState(false);
  const [copiedBreadcrumb, setCopiedBreadcrumb] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDrilling, setIsDrilling] = useState(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track drill direction: +1 = going deeper, -1 = going back
  const prevDrillDepthRef = useRef(drillStack.length);
  const drillEnterY = drillStack.length >= prevDrillDepthRef.current ? 10 : -10;
  prevDrillDepthRef.current = drillStack.length;

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

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.id === "__ghost_entry_pin__") return;
      setHasInteracted(true);
      // 150ms delay: short enough to feel instant, long enough to cancel if a
      // double-click follows — prevents the sidebar flash on double-click.
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      const { clientX, clientY } = event;
      clickTimerRef.current = setTimeout(() => {
        onNodeClick(node.data as FlowNode, clientX, clientY);
      }, 150);
    },
    [onNodeClick],
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
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

  const isDetail = drillStack.length > 0;

  return (
    <div ref={containerRef} className="w-full h-full bg-black relative flex flex-col">
      {/* Breadcrumb bar — only shown when drilling into a node */}
      <AnimatePresence>
        {isDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 40, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="flex items-center gap-1 px-4 border-b border-white/10 bg-black/85 backdrop-blur-sm shrink-0 overflow-hidden z-20 justify-between"
          >
            <button
              onClick={() => onBackTo(-1)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 cursor-pointer transition-colors"
            >
              <Home className="w-3 h-3" />
              <span className="font-mono">{endpointLabel}</span>
            </button>

            {drillStack.map((entry, idx) => {
              const isLast = idx === drillStack.length - 1;
              return (
                <motion.div
                  key={entry.id}
                  className="flex items-center gap-1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", damping: 28, stiffness: 280 }}
                >
                  <ChevronRight className="w-3 h-3 text-gray-700" />
                  <button
                    onClick={() => !isLast && onBackTo(idx)}
                    className={`text-xs transition-colors ${
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

            <button
              onClick={handleCopyBreadcrumb}
              aria-label="Copy breadcrumb path"
              className="ml-auto text-gray-400 hover:text-gray-200 active:text-gray-100 transition-colors p-1 rounded"
            >
              {copiedBreadcrumb ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flow canvas — keyed on drill depth; direction-aware spring entrance */}
      <motion.div
        key={drillStack.length}
        className="flex-1 relative z-10"
        initial={{ opacity: 0, y: drillEnterY }}
        animate={{ opacity: isDrilling ? 0.6 : 1, y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
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
              className={`p-1.5 rounded-md border transition-colors ${copied ? "text-white border-white/20 bg-white/8" : "text-gray-500 border-white/10 bg-black/40 hover:text-gray-300 hover:border-white/20 active:bg-white/5"}`}
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
                  className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/85 border border-white/8 text-[11px] text-white/50 font-mono select-none"
                >
                  <span>click to inspect</span>
                  <span className="w-px h-3 bg-white/15" />
                  <span>double-click to drill in</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Panel>
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.05)" />
          <Controls
            showInteractive={false}
            className="bg-black/90! backdrop-blur-sm! border! border-white/10! fill-gray-400 stroke-gray-400 text-gray-400 [&>button]:bg-transparent! [&>button]:border-b! [&>button]:border-white/10! [&>button:hover]:bg-white/10!"
          />
        </ReactFlow>
      </motion.div>
    </div>
  );
}

export function FlowCanvas({ path, drillStack, onNodeClick, onNodeDrillDown, onBackTo }: FlowCanvasProps) {
  const currentNodeId = drillStack.length > 0 ? drillStack[drillStack.length - 1].id : null;
  const currentDetail = currentNodeId ? path.nodeDetails[currentNodeId] ?? null : null;

  const activeNodes = currentDetail ? currentDetail.nodes : path.nodes;
  const activeEdges = currentDetail ? currentDetail.edges : path.edges;

  const endpointLabel = `${path.method} ${path.endpoint}`;
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <ReactFlowProvider>
      <Canvas
        activeNodes={activeNodes}
        activeEdges={activeEdges}
        drillStack={drillStack}
        endpointLabel={endpointLabel}
        containerRef={containerRef}
        onNodeClick={onNodeClick}
        onNodeDrillDown={onNodeDrillDown}
        onBackTo={onBackTo}
      />
    </ReactFlowProvider>
  );
}
