"use client";

import { useState } from "react";

import { useExecutionPaths } from "@/hooks/useExecutionPaths";
import { ExecutionPath, FlowNode, NodeDetail } from "@/lib/mockData";
import { Switchboard } from "@/components/Switchboard";
import { FlowCanvas } from "@/components/FlowCanvas";
import { IntelSidebar } from "@/components/IntelSidebar";

export default function Home() {
  const { paths, status, usingMockData } = useExecutionPaths();
  const [selectedPath, setSelectedPath] = useState<ExecutionPath | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [drillNodeId, setDrillNodeId] = useState<string | null>(null);

  const activePath = selectedPath ?? paths[0] ?? null;

  // When drilling into a node, synthesize a temporary "path" from its detail graph
  const activeDetail: NodeDetail | null =
    drillNodeId && activePath ? (activePath.nodeDetails[drillNodeId] ?? null) : null;

  const handleSelectPath = (path: ExecutionPath) => {
    setSelectedPath(path);
    setSelectedNode(null);
    setDrillNodeId(null);
  };

  const handleNodeClick = (node: FlowNode) => {
    if (!drillNodeId && node.hasDetail) {
      // Root layer: drill into this node's internal graph
      setDrillNodeId(node.id);
      setSelectedNode(null);
    } else {
      // Detail layer (or node without detail): open intel sidebar
      setSelectedNode(node);
    }
  };

  const handleBack = () => {
    setDrillNodeId(null);
    setSelectedNode(null);
  };

  if (status === "loading") {
    return (
      <div className="flex w-full h-screen bg-[#0f1115] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-sm">Connecting to FlowMap sidecar…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-[#0f1115] text-[#e2e8f0] overflow-hidden">
      {usingMockData && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 text-xs bg-yellow-900/60 border border-yellow-700 text-yellow-300 px-3 py-1 rounded-full">
          Sidecar offline — showing demo data
        </div>
      )}

      <Switchboard
        paths={paths}
        selectedPath={activePath}
        onSelectPath={handleSelectPath}
      />

      <main className="flex-1 relative">
        {activePath ? (
          <FlowCanvas
            path={activePath}
            detail={activeDetail}
            onNodeClick={handleNodeClick}
            onBack={handleBack}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            Select an endpoint to visualize its execution path.
          </div>
        )}
      </main>

      <IntelSidebar node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}
