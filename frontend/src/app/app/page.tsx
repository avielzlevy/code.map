"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SPRING_DEFAULT, SPRING_SNAPPY } from "@/lib/spring";

import { useExecutionPaths } from "@/hooks/useExecutionPaths";
import { ExecutionPath, FlowNode } from "@/lib/mockData";
import { Switchboard } from "@/components/Switchboard";
import { FlowCanvas } from "@/components/FlowCanvas";
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
  const [drillStack, setDrillStack] = useState<DrillEntry[]>([]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [promptCopied, setPromptCopied] = useState(false);

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
    setDrillStack([]);
  };

  const handleNodeDrillDown = (node: FlowNode) => {
    if (node.hasDetail) {
      setDrillStack((prev) => {
        if (prev.some((e) => e.id === node.id)) return prev;
        return [...prev, { id: node.id, label: node.funcName }];
      });
    }
  };

  const handleBackTo = (index: number) => {
    // index === -1 means back to root
    setDrillStack((prev) => prev.slice(0, index + 1));
  };

  const handleSelectEndpoint = (path: ExecutionPath) => {
    setSelectedPath(path);
    setDrillStack([]);
  };

  const handleCopyLLMPrompt = () => {
    const prompt =
      "I'm using code-map to visualize API execution paths. " +
      "My project has no routes yet and code-map can't detect anything. " +
      "Help me write a minimal REST endpoint — in NestJS or FastAPI — " +
      "so code-map has something to trace. Show only what's needed to define " +
      "one route handler and start the server.";
    navigator.clipboard.writeText(prompt).catch(() => {});
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const handleSelectNodeFromSearch = (path: ExecutionPath, _node: FlowNode, parentId: string | null) => {
    setSelectedPath(path);
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

  if (status === "error") {
    return (
      <div className="flex w-full h-screen bg-black items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-[13px] font-mono font-semibold text-white/60">Sidecar unreachable.</span>
          <span className="text-[11px] font-mono text-gray-600 max-w-[220px] leading-relaxed">
            Make sure your backend is running with the code-map plugin active, then refresh.
          </span>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 rounded-lg bg-white text-black font-semibold text-[12px] hover:bg-white/90 transition-colors"
          >
            Refresh
          </button>
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
              onNodeDrillDown={handleNodeDrillDown}
              onBackTo={handleBackTo}
            />
          ) : (
            <motion.div
              className="flex h-full flex-col items-center justify-center gap-6"
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }}
            >
              {/* Empty graph illustration — dashed to signal "nothing here yet" */}
              <motion.div
                className="flex flex-col items-center select-none"
                aria-hidden="true"
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: SPRING_DEFAULT } }}
              >
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-28 h-7 rounded-lg border border-dashed border-white/10 bg-white/[0.02]" />
                    {i < 2 && <div className="w-px h-4 border-l border-dashed border-white/6" />}
                  </div>
                ))}
              </motion.div>

              {/* Headline + explanation */}
              <motion.div
                className="flex flex-col items-center gap-2 text-center"
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: SPRING_DEFAULT } }}
              >
                <p className="text-[13px] font-mono font-semibold text-white/60">
                  No endpoints detected.
                </p>
                <p className="text-[11px] text-gray-600 max-w-[220px] leading-relaxed">
                  Your project may have no routes yet, or the plugin isn&apos;t receiving traffic.
                  Write an endpoint and restart your server.
                </p>
              </motion.div>

              {/* Actions */}
              <motion.div
                className="flex flex-col items-center gap-2"
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: SPRING_DEFAULT } }}
              >
                <motion.button
                  onClick={() => window.location.reload()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_SNAPPY}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold text-[12px] hover:bg-white/90 transition-colors"
                >
                  Refresh
                </motion.button>
                <button
                  onClick={handleCopyLLMPrompt}
                  className="text-[11px] font-mono text-gray-700 hover:text-gray-400 transition-colors"
                >
                  {promptCopied ? "✓ copied" : "copy a prompt for your LLM →"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </main>

      </div>

      <CommandPalette
        paths={paths}
        onSelectEndpoint={handleSelectEndpoint}
        onSelectNode={handleSelectNodeFromSearch}
      />
    </div>
  );
}
