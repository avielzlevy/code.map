"use client";

import { useEffect, useCallback, useState } from "react";
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
import { StandardNode, EnhancedNode } from "./nodes/CustomNodes";
import { DrillEntry } from "@/app/page";

const nodeTypes = { standard: StandardNode, enhanced: EnhancedNode };

interface FlowCanvasProps {
  path: ExecutionPath;
  drillStack: DrillEntry[];
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
  onNodeClick,
  onNodeDrillDown,
  onBackTo,
}: {
  activeNodes: FlowNode[];
  activeEdges: FlowEdge[];
  drillStack: DrillEntry[];
  onNodeClick: (node: FlowNode) => void;
  onNodeDrillDown: (node: FlowNode) => void;
  onBackTo: (index: number) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const [copied, setCopied] = useState(false);
  const [copiedBreadcrumb, setCopiedBreadcrumb] = useState(false);

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
    const parts = ["Overview", ...drillStack.map((e) => e.label)];
    navigator.clipboard.writeText(parts.join(" > ")).then(() => {
      setCopiedBreadcrumb(true);
      setTimeout(() => setCopiedBreadcrumb(false), 1500);
    });
  }, [drillStack]);

  useEffect(() => {
    const g = buildDagreLayout(activeNodes, activeEdges);
    // Filter out any degenerate edges first
    const nodeIds = new Set(activeNodes.map((n) => n.id));
    const validEdges = activeEdges.filter(
      (e) => e.source !== e.target && nodeIds.has(e.source) && nodeIds.has(e.target),
    );
    const targets = new Set(validEdges.map((e) => e.target));
    const sources = new Set(validEdges.map((e) => e.source));
    setNodes(
      activeNodes.map((n) => {
        const pos = g.node(n.id);
        return {
          id: n.id,
          type: n.type,
          data: { ...n, hasIncoming: targets.has(n.id), hasOutgoing: sources.has(n.id) },
          position: { x: pos.x - 225, y: pos.y - ((n.intentTag || n.docstring) ? 55 : 40) },
        };
      }),
    );
    setEdges(validEdges.map((e) => buildReactFlowEdge(e)));

    const t = setTimeout(() => fitView({ padding: 0.25, duration: 350 }), 60);
    return () => clearTimeout(t);
  }, [activeNodes, activeEdges, setNodes, setEdges, fitView]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onNodeClick(node.data as FlowNode),
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
      {/* Breadcrumb bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-black/50 backdrop-blur-md shrink-0 min-h-[40px] justify-between z-20">
        <button
          onClick={() => onBackTo(-1)}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            isDetail ? "text-gray-500 hover:text-gray-300 cursor-pointer" : "text-gray-600 cursor-default"
          }`}
        >
          <Home className="w-3 h-3" />
          <span>Overview</span>
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
          title="Copy breadcrumb path"
          className="ml-auto text-gray-600 hover:text-gray-400 transition-colors p-1"
        >
          {copiedBreadcrumb ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {/* Flow canvas */}
      <div className="flex-1 relative z-10">
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
            <button
              onClick={handleCopy}
              title="Copy flow as text"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: "6px", color: copied ? "#4ade80" : "#6b7280" }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </Panel>
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.05)" />
          <Controls
            showInteractive={false}
            className="!bg-black/60 !backdrop-blur-xl !border !border-white/10 fill-gray-400 stroke-gray-400 text-gray-400 [&>button]:!bg-transparent [&>button]:!border-b [&>button]:!border-white/10 [&>button:hover]:!bg-white/10"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function FlowCanvas({ path, drillStack, onNodeClick, onNodeDrillDown, onBackTo }: FlowCanvasProps) {
  const currentNodeId = drillStack.length > 0 ? drillStack[drillStack.length - 1].id : null;
  const currentDetail = currentNodeId ? path.nodeDetails[currentNodeId] ?? null : null;

  const activeNodes = currentDetail ? currentDetail.nodes : path.nodes;
  const activeEdges = currentDetail ? currentDetail.edges : path.edges;

  return (
    <ReactFlowProvider>
      <Canvas
        activeNodes={activeNodes}
        activeEdges={activeEdges}
        drillStack={drillStack}
        onNodeClick={onNodeClick}
        onNodeDrillDown={onNodeDrillDown}
        onBackTo={onBackTo}
      />
    </ReactFlowProvider>
  );
}
