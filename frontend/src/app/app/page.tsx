"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { SPRING_DEFAULT, SPRING_SNAPPY } from "@/lib/spring";

import { useExecutionPaths } from "@/hooks/useExecutionPaths";
import { useGuide } from "@/hooks/useGuide";
import { ExecutionPath, FlowNode, GitInfo } from "@/lib/flow-types";
import { apiClient } from "@/lib/api-client";
import { Switchboard } from "@/components/Switchboard";
import { FlowCanvas } from "@/components/FlowCanvas";
import { CommandPalette } from "@/components/CommandPalette";
import { Guide } from "@/components/Guide";

export type DrillEntry = { id: string; label: string; fileName: string };

const LOADING_MESSAGES = [
  "Connecting to your backend…",
  "Tracing call stacks…",
  "Mapping execution paths…",
  "Reading function signatures…",
];

export default function Home() {
  const { paths, status, aiEnriching } = useExecutionPaths();
  const guide = useGuide();
  const [selectedPath, setSelectedPath] = useState<ExecutionPath | null>(null);
  const [drillStack, setDrillStack] = useState<DrillEntry[]>([]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);

  // Fetch git remote info once for "Open in GitHub" links
  useEffect(() => {
    apiClient.getGitInfo().then(setGitInfo).catch(() => {});
  }, []);

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

  // When guide is running it controls the drill level; otherwise use normal drillStack
  const activeDrillStack = guide.active ? guide.drillStack : drillStack;

  const handleSelectPath = (path: ExecutionPath) => {
    guide.exit();
    setSelectedPath(path);
    setDrillStack([]);
  };

  const handleStartGuide = (path: ExecutionPath) => {
    setSelectedPath(path);
    setDrillStack([]);
    guide.start(path);
  };

  const handleSelectEndpoint = handleSelectPath;

  const handleNodeDrillDown = (node: FlowNode) => {
    if (node.hasDetail) {
      setDrillStack((prev) => {
        if (prev.some((e) => e.id === node.id)) return prev;
        return [...prev, { id: node.id, label: node.funcName, fileName: node.fileName }];
      });
    }
  };

  const handleBackTo = (index: number) => {
    // index === -1 means back to root
    setDrillStack((prev) => prev.slice(0, index + 1));
  };

  const handleSelectNodeFromSearch = (path: ExecutionPath, _node: FlowNode, parentId: string | null) => {
    setSelectedPath(path);
    if (parentId) {
      const parentNode = path.nodes.find((n) => n.id === parentId);
      setDrillStack([{ id: parentId, label: parentNode ? parentNode.funcName : parentId, fileName: parentNode?.fileName ?? '' }]);
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
      <div className="flex w-full h-screen bg-black items-center justify-center px-6">
        <div className="flex flex-col items-center gap-5 text-center w-full max-w-xs">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[13px] font-mono font-semibold text-white/75">Backend unreachable</span>
            <span className="text-[11px] font-mono text-gray-500 leading-relaxed">
              Start your server with the code-map plugin installed, then refresh.
            </span>
          </div>

          {/* Quick-start steps */}
          <div className="w-full rounded-xl border border-white/8 bg-zinc-950 overflow-hidden text-left">
            <div className="px-4 py-2 border-b border-white/6">
              <span className="text-[9px] font-mono text-white/25 uppercase tracking-[0.18em]">Quick start</span>
            </div>
            <div className="px-4 py-3 border-b border-white/5 flex flex-col gap-1">
              <span className="text-[9px] font-mono text-amber-500/60 uppercase tracking-wider">NestJS</span>
              <code className="text-[11px] font-mono text-gray-400">
                <span className="text-gray-600">import</span>{" "}
                {"{ CodeMapModule }"}{" "}
                <span className="text-gray-600">from</span>{" "}
                <span className="text-gray-500">&apos;@code-map/nestjs&apos;</span>
              </code>
            </div>
            <div className="px-4 py-3 flex flex-col gap-1">
              <span className="text-[9px] font-mono text-amber-500/60 uppercase tracking-wider">FastAPI</span>
              <code className="text-[11px] font-mono text-gray-400">
                <span className="text-gray-600">from</span>{" "}
                <span className="text-gray-500">code_map</span>{" "}
                <span className="text-gray-600">import</span>{" "}
                CodeMapPlugin
              </code>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-[12px] hover:bg-white/90 transition-colors"
            >
              Refresh
            </button>
            <a
              href="/"
              className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 font-medium text-[12px] hover:border-white/20 hover:text-white transition-colors"
            >
              Back to home
            </a>
          </div>
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
        onStartGuide={handleStartGuide}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 relative">
          <AnimatePresence>
            {aiEnriching && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={SPRING_DEFAULT}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full border border-amber-500/25 bg-black/80 backdrop-blur-sm shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400/80 animate-pulse shrink-0" />
                <span className="text-[11px] font-mono text-amber-400/80 whitespace-nowrap">Generating summaries…</span>
              </motion.div>
            )}
          </AnimatePresence>
          {activePath ? (
            <>
              <FlowCanvas
                path={activePath}
                drillStack={activeDrillStack}
                onNodeDrillDown={guide.active ? () => {} : handleNodeDrillDown}
                onBackTo={guide.active ? () => {} : handleBackTo}
                guideNodeId={guide.guideNodeId}
                gitInfo={gitInfo}
              />
              <Guide guide={guide} />
            </>
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
                    <div className="w-28 h-7 rounded-lg border border-dashed border-white/10 bg-white/2" />
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
                  No endpoints found.
                </p>
                <p className="text-[11px] text-gray-600 max-w-55 leading-relaxed">
                  code-map scans your source files at startup. Make sure your controllers and routes are inside the configured source root.
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
              </motion.div>
            </motion.div>
          )}
        </main>
      </div>

      <CommandPalette
        paths={paths}
        onSelectEndpoint={handleSelectEndpoint}
        onSelectNode={handleSelectNodeFromSearch}
        onStartGuide={handleStartGuide}
      />
    </div>
  );
}
