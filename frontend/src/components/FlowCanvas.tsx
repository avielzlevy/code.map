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

import { ExecutionPath, FlowNode } from "@/lib/mockData";
import { StandardNode, EnhancedNode } from "./nodes/CustomNodes";

const nodeTypes = {
  standard: StandardNode,
  enhanced: EnhancedNode,
};

interface FlowCanvasProps {
  path: ExecutionPath;
  onNodeClick: (node: FlowNode) => void;
}

export function FlowCanvas({ path, onNodeClick }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    // Layout with dagre
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB", nodesep: 150, ranksep: 180 });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to dagre
    path.nodes.forEach((n) => {
      // increased dimensions slightly to match new node sizes
      g.setNode(n.id, { width: 260, height: 100 });
    });

    // Add edges to dagre sorted by callOrder so siblings are ranked left-to-right in source sequence
    [...path.edges]
      .sort((a, b) => a.callOrder - b.callOrder)
      .forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);

    // Map to React Flow format
    const newNodes = path.nodes.map((n) => {
      const nodeWithPosition = g.node(n.id);
      return {
        id: n.id,
        type: n.type,
        data: { ...n },
        position: {
          x: nodeWithPosition.x - 130, // center offset for new width
          y: nodeWithPosition.y - 50,
        },
      };
    });

    const newEdges = path.edges.map((e) => {
      const isStep = e.edgeType === "step";
      const isTargetEnhanced = path.nodes.find(n => n.id === e.target)?.type === "enhanced";

      // 'call' edges: blue/green animated — entering a sub-function
      // 'step' edges: gray dashed — sequential continuation in the same function body
      const edgeColor = isStep ? "#4b5563" : isTargetEnhanced ? "#10b981" : "#3b82f6";

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: !isStep,
        type: "smoothstep",
        label: isStep ? "then" : undefined,
        labelStyle: { fill: "#6b7280", fontSize: 10 },
        labelBgStyle: { fill: "transparent" },
        style: {
          stroke: edgeColor,
          strokeWidth: isStep ? 1 : 2,
          strokeDasharray: isStep ? "5 4" : undefined,
          filter: isStep ? undefined : `drop-shadow(0 0 4px ${edgeColor}80)`,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: isStep ? 14 : 20,
          height: isStep ? 14 : 20,
        },
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [path, setNodes, setEdges]);

  return (
    <div className="w-full h-full bg-[#0a0c10]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(event: ReactMouseEvent, node: Node) => onNodeClick(node.data as FlowNode)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="flow-canvas-premium"
      >
        {/* Changed background from Dots to subtle Grid/Lines */}
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1f242e" />
        <Controls 
          showInteractive={false} 
          className="bg-[#13151a] border-[#2a2f3a] fill-gray-400 stroke-gray-400 text-gray-400 [&>button]:!bg-[#13151a] [&>button]:!border-b-[#2a2f3a] [&>button:hover]:!bg-[#1e222a]"
        />
      </ReactFlow>
    </div>
  );
}
