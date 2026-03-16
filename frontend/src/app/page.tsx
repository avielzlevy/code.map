"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

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
  const [panelAnchor, setPanelAnchor] = useState({ x: 0, y: 0 });
  const [drillStack, setDrillStack] = useState<DrillEntry[]>([]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [isDrilling, setIsDrilling] = useState(false);

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
      "background: #fff; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold;",
      ""
    );
  }, []);

  const activePath = selectedPath ?? paths[0] ?? null;

  const handleSelectPath = (path: ExecutionPath) => {
    setSelectedPath(path);
    setSelectedNode(null);
    setDrillStack([]);
  };

  const handleNodeClick = (node: FlowNode, screenX: number, screenY: number) => {
    setSelectedNode(node);
    setPanelAnchor({ x: screenX, y: screenY });
  };

  const handleNodeDrillDown = (node: FlowNode) => {
    if (node.hasDetail) {
      setIsDrilling(true);
      setDrillStack((prev) => {
        if (prev.some((e) => e.id === node.id)) return prev; // already in stack, prevent cycle
        return [...prev, { id: node.id, label: node.funcName }];
      });
      setSelectedNode(null);
      setTimeout(() => setIsDrilling(false), 400);
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
          <span className="text-[11px] font-mono text-gray-400">{LOADING_MESSAGES[loadingMsgIdx]}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-screen bg-black text-foreground overflow-hidden">
      <Switchboard
        paths={paths}
        selectedPath={activePath}
        onSelectPath={handleSelectPath}
        usingMockData={usingMockData}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 relative">
          {activePath ? (
            <FlowCanvas
              path={activePath}
              drillStack={drillStack}
              onNodeClick={handleNodeClick}
              onNodeDrillDown={handleNodeDrillDown}
              onBackTo={handleBackTo}
            />
          ) : (
            <motion.div
              className="flex h-full flex-col items-center justify-center gap-7"
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } } }}
            >
              {/* Mini flow illustration */}
              <motion.div
                className="flex flex-col items-center select-none"
                aria-hidden="true"
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 28, stiffness: 260 } } }}
              >
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-28 h-7 rounded-lg border border-white/5 bg-white/[2.5]" />
                    {i < 2 && <div className="w-px h-4 border-l border-dashed border-white/8" />}
                  </div>
                ))}
              </motion.div>
              {/* Copy + CTA */}
              <motion.div
                className="flex flex-col items-center gap-3"
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 28, stiffness: 260 } } }}
              >
                <p className="text-[11px] font-mono text-gray-500 text-center max-w-[190px] leading-relaxed">
                  Select an endpoint to visualize its execution path.
                </p>
                <motion.button
                  onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", damping: 22, stiffness: 320 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 bg-white/5 hover:bg-white/8 hover:border-white/15 active:bg-white/10 transition-colors text-gray-400 hover:text-gray-200 text-[11px] font-mono"
                >
                  Search endpoints
                  <kbd className="text-[11px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-600">⌘K</kbd>
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </main>

      </div>

      <IntelSidebar
        node={selectedNode}
        anchorX={panelAnchor.x}
        anchorY={panelAnchor.y}
        onClose={() => setSelectedNode(null)}
        onDrillDown={handleNodeDrillDown}
        instantClose={isDrilling}
      />

      <CommandPalette
        paths={paths}
        onSelectEndpoint={handleSelectEndpoint}
        onSelectNode={handleSelectNodeFromSearch}
      />
    </div>
  );
}
