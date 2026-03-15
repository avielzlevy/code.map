"use client";

import { useEffect, MouseEvent as ReactMouseEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  BackgroundVariant
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { ArrowLeft } from "lucide-react";

import { ExecutionPath, FlowNode, NodeDetail } from "@/lib/mockData";
import { StandardNode, EnhancedNode } from "./nodes/CustomNodes";

const nodeTypes = {
  standard: StandardNode,
  enhanced: EnhancedNode,
};

interface FlowCanvasProps {
  path: ExecutionPath;
  detail: NodeDetail | null;
  onNodeClick: (node: FlowNode) => void;
  onBack: () => void;
}

function layoutNodes(nodes: FlowNode[], edges: { source: string; target: string; edgeType: "call" | "step" }[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => g.setNode(n.id, { width: 260, height: n.intentTag ? 110 : 80 }));

  // Feed edges sorted by callOrder so dagre respects source sequence for sibling ordering
  [...edges]
    .sort((a, b) => {
      const ae = edges.find(e => e.source === a.source && e.target === a.target);
      const be = edges.find(e => e.source === b.source && e.target === b.target);
      return (ae ? 0 : 0) - (be ? 0 : 0);
    })
    .forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);
  return g;
}

export function FlowCanvas({ path, detail, onNodeClick, onBack }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const isDetail = detail !== null;
  const activeNodes = isDetail ? detail.nodes : path.nodes;
  const activeEdges = isDetail ? detail.edges : path.edges;

  useEffect(() => {
    const g = layoutNodes(activeNodes, activeEdges);

    const newNodes: Node[] = activeNodes.map((n) => {
      const pos = g.node(n.id);
      return {
        id: n.id,
        type: n.type,
        data: { ...n },
        position: { x: pos.x - 130, y: pos.y - (n.intentTag ? 55 : 40) },
      };
    });

    const newEdges: Edge[] = activeEdges.map((e) => {
      const isStep = e.edgeType === "step";
      const isTargetEnhanced = activeNodes.find((n) => n.id === e.target)?.type === "enhanced";
      const edgeColor = isStep ? "#374151" : isTargetEnhanced ? "#10b981" : "#3b82f6";

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: !isStep,
        type: "smoothstep",
        style: {
          stroke: edgeColor,
          strokeWidth: isStep ? 1 : 2,
          strokeDasharray: isStep ? "5 4" : undefined,
          opacity: isStep ? 0.5 : 1,
          filter: isStep ? undefined : `drop-shadow(0 0 4px ${edgeColor}80)`,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: isStep ? 12 : 20,
          height: isStep ? 12 : 20,
        },
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [activeNodes, activeEdges, setNodes, setEdges]);

  return (
    <div className="w-full h-full bg-[#0a0c10] relative">
      {isDetail && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#13151a] border border-[#2a2f3a] text-gray-400 hover:text-gray-200 hover:border-[#3b82f6]/50 transition-all text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to overview
        </button>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_event: ReactMouseEvent, node: Node) => onNodeClick(node.data as FlowNode)}
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
  );
}
