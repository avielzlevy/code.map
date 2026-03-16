"use client";

import { useState, useEffect } from "react";

import { useExecutionPaths } from "@/hooks/useExecutionPaths";
import { ExecutionPath, FlowNode } from "@/lib/mockData";
import { Switchboard } from "@/components/Switchboard";
import { FlowCanvas } from "@/components/FlowCanvas";
import { IntelSidebar } from "@/components/IntelSidebar";
import { CommandPalette } from "@/components/CommandPalette";

export type DrillEntry = { id: string; label: string };

const LOADING_MESSAGES = [
  "Connecting to sidecar…",
  "Tracing call stacks…",
  "Mapping execution paths…",
  "Reading function signatures…",
];

export default function Home() {
  const { paths, status, usingMockData } = useExecutionPaths();
  const [selectedPath, setSelectedPath] = useState<ExecutionPath | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [drillStack, setDrillStack] = useState<DrillEntry[]>([]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Rotate loading messages while connecting
  useEffect(() => {
    if (status !== "loading") return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 900);
    return () => clearInterval(interval);
  }, [status]);

  // Developer easter egg — console signature
  useEffect(() => {
    console.log(
      "%c code.map %c\n\n" +
        "  ┌─────────────────┐\n" +
        "  │  route handler  │\n" +
        "  └────────┬────────┘\n" +
        "           │\n" +
        "  ┌────────▼────────┐\n" +
        "  │   controller    │\n" +
        "  └────────┬────────┘\n" +
        "           │\n" +
        "  ┌────────▼────────┐\n" +
        "  │    service      │\n" +
        "  └─────────────────┘\n\n" +
        "  Visualizing your API execution paths.\n" +
        "  Built with Next.js · @xyflow/react · dagre\n",
      "background: #10b981; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold;",
      ""
    );
  }, []);

  const activePath = selectedPath ?? paths[0] ?? null;

  const handleSelectPath = (path: ExecutionPath) => {
    setSelectedPath(path);
    setSelectedNode(null);
    setDrillStack([]);
  };

  const handleNodeClick = (node: FlowNode) => {
    setSelectedNode(node);
  };

  const handleNodeDrillDown = (node: FlowNode) => {
    if (node.hasDetail) {
      setDrillStack((prev) => {
        if (prev.some((e) => e.id === node.id)) return prev; // already in stack, prevent cycle
        return [...prev, { id: node.id, label: node.funcName }];
      });
      setSelectedNode(null);
    }
  };

  const handleBackTo = (index: number) => {
    // index === -1 means back to root
    setDrillStack((prev) => prev.slice(0, index + 1));
    setSelectedNode(null);
  };

  const handleSelectEndpoint = (path: ExecutionPath) => {
    setSelectedPath(path);
    setSelectedNode(null);
    setDrillStack([]);
  };

  const handleSelectNodeFromSearch = (path: ExecutionPath, node: FlowNode, parentId: string | null) => {
    setSelectedPath(path);
    setSelectedNode(node);
    
    if (parentId) {
      const parentNode = path.nodes.find(n => n.id === parentId);
      setDrillStack([{ id: parentId, label: parentNode ? parentNode.funcName : parentId }]);
    } else {
      setDrillStack([]);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex w-full h-screen bg-black items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-600">
          <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-emerald-400 animate-spin" />
          <span className="text-xs font-mono text-gray-600">{LOADING_MESSAGES[loadingMsgIdx]}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-black text-[#e2e8f0] overflow-hidden">
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
            drillStack={drillStack}
            sidebarOpen={selectedNode !== null}
            onNodeClick={handleNodeClick}
            onNodeDrillDown={handleNodeDrillDown}
            onBackTo={handleBackTo}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-7">
            {/* Mini flow illustration */}
            <div className="flex flex-col items-center select-none" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-28 h-7 rounded-lg border border-white/[0.07] bg-white/[0.025]" />
                  {i < 2 && <div className="w-px h-4 border-l border-dashed border-white/[0.08]" />}
                </div>
              ))}
            </div>
            {/* Copy + CTA */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs font-mono text-gray-600 text-center max-w-[190px] leading-relaxed">
                Select an endpoint to visualize its execution path.
              </p>
              <button
                onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] active:bg-white/[0.08] transition-colors text-gray-500 hover:text-gray-300 text-xs font-mono"
              >
                Search endpoints
                <kbd className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-600">⌘K</kbd>
              </button>
            </div>
          </div>
        )}
      </main>

      <IntelSidebar node={selectedNode} onClose={() => setSelectedNode(null)} onDrillDown={handleNodeDrillDown} />
      
      <CommandPalette 
        paths={paths} 
        onSelectEndpoint={handleSelectEndpoint}
        onSelectNode={handleSelectNodeFromSearch} 
      />
    </div>
  );
}
