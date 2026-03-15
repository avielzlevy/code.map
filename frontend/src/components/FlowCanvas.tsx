"use client";

import { useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
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
import { ChevronRight, Home } from "lucide-react";

import { ExecutionPath, FlowNode, FlowEdge } from "@/lib/mockData";
import { StandardNode, EnhancedNode } from "./nodes/CustomNodes";
import { DrillEntry } from "@/app/page";

const nodeTypes = { standard: StandardNode, enhanced: EnhancedNode };

interface FlowCanvasProps {
  path: ExecutionPath;
  drillStack: DrillEntry[];
  onNodeClick: (node: FlowNode) => void;
  onBackTo: (index: number) => void;
}

function buildDagreLayout(nodes: FlowNode[], edges: FlowEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: 260, height: n.intentTag ? 110 : 80 }));
  [...edges].sort((a, b) => a.callOrder - b.callOrder).forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return g;
}

function buildReactFlowEdge(e: FlowEdge, activeNodes: FlowNode[]): Edge {
  const isStep = e.edgeType === "step";
  const isTargetEnhanced = activeNodes.find((n) => n.id === e.target)?.type === "enhanced";
  const color = isStep ? "#374151" : isTargetEnhanced ? "#10b981" : "#3b82f6";
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    animated: !isStep,
    type: "smoothstep",
    style: {
      stroke: color,
      strokeWidth: isStep ? 1 : 2,
      strokeDasharray: isStep ? "5 4" : undefined,
      opacity: isStep ? 0.45 : 1,
      filter: isStep ? undefined : `drop-shadow(0 0 4px ${color}80)`,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: isStep ? 12 : 18, height: isStep ? 12 : 18 },
  };
}

/** Inner component — lives inside ReactFlowProvider so it can use useReactFlow. */
function Canvas({
  activeNodes,
  activeEdges,
  drillStack,
  onNodeClick,
  onBackTo,
}: {
  activeNodes: FlowNode[];
  activeEdges: FlowEdge[];
  drillStack: DrillEntry[];
  onNodeClick: (node: FlowNode) => void;
  onBackTo: (index: number) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const g = buildDagreLayout(activeNodes, activeEdges);
    setNodes(
      activeNodes.map((n) => {
        const pos = g.node(n.id);
        return {
          id: n.id,
          type: n.type,
          data: { ...n },
          position: { x: pos.x - 130, y: pos.y - (n.intentTag ? 55 : 40) },
        };
      }),
    );
    setEdges(activeEdges.map((e) => buildReactFlowEdge(e, activeNodes)));

    // Auto-fit after nodes are painted
    const t = setTimeout(() => fitView({ padding: 0.25, duration: 350 }), 60);
    return () => clearTimeout(t);
  }, [activeNodes, activeEdges, setNodes, setEdges, fitView]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onNodeClick(node.data as FlowNode),
    [onNodeClick],
  );

  const isDetail = drillStack.length > 0;

  return (
    <div className="w-full h-full bg-[#0a0c10] relative flex flex-col">
      {/* Breadcrumb bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#1e222a] bg-[#0d0f14] shrink-0 min-h-[40px]">
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
      </div>

      {/* Flow canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1f242e" />
          <Controls
            showInteractive={false}
            className="bg-[#13151a] border-[#2a2f3a] fill-gray-400 stroke-gray-400 text-gray-400 [&>button]:!bg-[#13151a] [&>button]:!border-b-[#2a2f3a] [&>button:hover]:!bg-[#1e222a]"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function FlowCanvas({ path, drillStack, onNodeClick, onBackTo }: FlowCanvasProps) {
  // Resolve which nodes/edges to display based on the drill stack
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
        onBackTo={onBackTo}
      />
    </ReactFlowProvider>
  );
}
