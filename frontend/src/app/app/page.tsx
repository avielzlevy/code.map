"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { SPRING_DEFAULT, SPRING_SNAPPY } from "@/lib/spring";

import { useExecutionPaths } from "@/hooks/useExecutionPaths";
import { useGuide } from "@/hooks/useGuide";
import { ExecutionPath, FlowNode, FlowEdge, GitInfo, GuideChangeType, RawGraph, RawGraphNode } from "@/lib/flow-types";
import { apiClient } from "@/lib/api-client";
import { Switchboard } from "@/components/Switchboard";
import { FlowCanvas } from "@/components/FlowCanvas";
import { CommandPalette } from "@/components/CommandPalette";
import { Guide } from "@/components/Guide";

export type DrillEntry = { id: string; label: string; fileName: string };

/** Build a depth-1 neighborhood ExecutionPath centered on a raw graph node. */
function buildNeighborhoodPath(center: RawGraphNode, graph: RawGraph): ExecutionPath {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  const relevantEdges = graph.edges.filter(
    (e) => e.from === center.id || e.to === center.id,
  );

  const neighborIds = new Set<string>([center.id]);
  relevantEdges.forEach((e) => { neighborIds.add(e.from); neighborIds.add(e.to); });

  const frontendNodes: FlowNode[] = [...neighborIds]
    .map((id) => nodeMap.get(id))
    .filter((n): n is RawGraphNode => !!n)
    .map((n) => ({
      id: n.id,
      type: (n.customTag || n.aiSummary ? "enhanced" : "standard") as "standard" | "enhanced",
      funcName: n.methodName.includes("#") ? n.methodName.split("#").pop()! : n.methodName,
      fileName: n.filePath,
      line: n.lineNumber,
      intentTag: n.customTag,
      docstring: n.docstring,
      aiSummary: n.aiSummary,
      hasDetail: false,
    }));

  const frontendEdges: FlowEdge[] = relevantEdges.map((e) => ({
    id: `${e.from}→${e.to}`,
    source: e.from,
    target: e.to,
    callOrder: e.callOrder,
    edgeType: "call" as const,
  }));

  const baseName = center.methodName.includes("#")
    ? center.methodName.split("#").pop()!
    : center.methodName;

  return {
    endpoint: `~${baseName}`,
    method: "GRAPH",
    nodes: frontendNodes,
    edges: frontendEdges,
    nodeDetails: {},
  };
}

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
  const [orphanPath, setOrphanPath] = useState<ExecutionPath | null>(null);
  const [graphData, setGraphData] = useState<RawGraph | null>(null);
  const [drillStack, setDrillStack] = useState<DrillEntry[]>([]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [guideNotice, setGuideNotice] = useState<string | null>(null);
  const [savedGuides, setSavedGuides] = useState<string[]>([]);

  // Fetch git remote info once for "Open in GitHub" links
  useEffect(() => {
    apiClient.getGitInfo().then(setGitInfo).catch(() => {});
  }, []);

  // Fetch the full parsed graph for global search. Re-fetches whenever paths rebuild
  // (paths reference changes on every SSE push), keeping graph in sync with the canvas.
  useEffect(() => {
    if (status !== "success") return;
    apiClient.getGraph().then(setGraphData).catch(() => {});
  }, [paths, status]);

  // Fetch the list of skill-authored guides for the ⌘K picker
  useEffect(() => {
    apiClient.getSavedGuides().then(setSavedGuides).catch(() => {});
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

  const activePath = orphanPath ?? selectedPath ?? paths[0] ?? null;

  // When guide is running it controls the drill level; otherwise use normal drillStack
  const activeDrillStack = guide.active ? guide.drillStack : drillStack;

  const handleSelectPath = (path: ExecutionPath) => {
    guide.exit();
    setSelectedPath(path);
    setOrphanPath(null);
    setDrillStack([]);
  };

  const handleSelectOrphanNode = (rawNode: RawGraphNode) => {
    if (!graphData) return;
    guide.exit();
    setOrphanPath(buildNeighborhoodPath(rawNode, graphData));
    setDrillStack([]);
  };

  const handleStartGuide = (path: ExecutionPath) => {
    setSelectedPath(path);
    setOrphanPath(null);
    setDrillStack([]);
    guide.start(path);
  };

  // Open and play a saved (skill-authored) guide by slug.
  const handleOpenGuide = async (slug: string) => {
    setGuideNotice("Loading guide…");
    try {
      const artifact = await apiClient.getSavedGuide(slug);
      if (artifact.steps.length === 0) {
        setGuideNotice("Guide has no steps.");
        setTimeout(() => setGuideNotice(null), 3000);
        return;
      }
      setGuideNotice(null);
      setDrillStack([]);
      guide.startGuide(artifact, paths, gitInfo?.root ?? "");
    } catch {
      setGuideNotice(`Couldn't load guide "${slug}".`);
      setTimeout(() => setGuideNotice(null), 4000);
    }
  };

  // Deep link: /app?guide=<slug> auto-loads a skill-authored guide and plays it.
  const guideLoadedRef = useRef(false);
  useEffect(() => {
    if (guideLoadedRef.current || paths.length === 0 || !gitInfo) return;
    const slug = new URLSearchParams(window.location.search).get("guide");
    if (!slug) return;
    guideLoadedRef.current = true;
    setGuideNotice("Loading guide…");
    apiClient
      .getSavedGuide(slug)
      .then((artifact) => {
        if (artifact.steps.length === 0) {
          setGuideNotice("Guide has no steps.");
          setTimeout(() => setGuideNotice(null), 3000);
          return;
        }
        setGuideNotice(null);
        setDrillStack([]);
        guide.startGuide(artifact, paths, gitInfo.root);
      })
      .catch(() => {
        setGuideNotice(`Couldn't load guide "${slug}".`);
        setTimeout(() => setGuideNotice(null), 4000);
      });
  }, [paths, gitInfo, guide]);

  // Guide step navigation — orphan-aware.
  // Path-connected steps follow the existing execution-path behaviour.
  // Orphan steps (no endpoint) build a local-neighborhood view exactly as the
  // command palette does when an orphan node is selected.
  useEffect(() => {
    if (!guide.active || !guide.currentStep) return;
    const { node, endpoint } = guide.currentStep;

    if (endpoint) {
      const match = paths.find((p) => p.endpoint === endpoint);
      if (match && match !== selectedPath) setSelectedPath(match);
      setOrphanPath(null);
      return;
    }

    // Orphan step: node.id is the repo-relative id from the artifact.
    // graphData nodes carry absolute ids — absolutise before lookup.
    if (!graphData) return;
    const absId = gitInfo?.root ? `${gitInfo.root}/${node.id}` : node.id;
    const rawNode = graphData.nodes.find((n) => n.id === absId || n.id === node.id);
    if (rawNode) setOrphanPath(buildNeighborhoodPath(rawNode, graphData));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.active, guide.currentStep, paths, graphData, gitInfo]);

  // For orphan guide steps the step's node.id is repo-relative; orphanPath nodes
  // carry absolute ids. Normalise so the canvas can match for highlight + fitView.
  const activeGuideNodeId = useMemo((): string | null => {
    if (!guide.active || !guide.currentStep) return null;
    if (guide.currentStep.endpoint) return guide.guideNodeId; // path-connected — id already absolute
    if (!graphData || !gitInfo?.root) return guide.guideNodeId;
    const absId = `${gitInfo.root}/${guide.currentStep.node.id}`;
    return graphData.nodes.find((n) => n.id === absId)?.id ?? guide.guideNodeId;
  }, [guide.active, guide.currentStep, guide.guideNodeId, graphData, gitInfo]);

  // guide.changes keys may be relative for orphan steps — add absolute counterparts
  // so the canvas border-colouring fires for nodes in orphanPath.
  const activeGuideChanges = useMemo((): Record<string, GuideChangeType> => {
    if (!gitInfo?.root) return guide.changes;
    const out: Record<string, GuideChangeType> = {};
    for (const [id, ct] of Object.entries(guide.changes)) {
      out[id] = ct;
      if (!id.startsWith("/")) out[`${gitInfo.root}/${id}`] = ct;
    }
    return out;
  }, [guide.changes, gitInfo]);

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
            {orphanPath && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={SPRING_DEFAULT}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-black/80 backdrop-blur-sm shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
              >
                <span className="text-[11px] font-mono text-white/40 whitespace-nowrap">graph neighborhood · not in execution paths</span>
                <button
                  onClick={() => setOrphanPath(null)}
                  className="text-white/20 hover:text-white/60 transition-colors text-[11px] font-mono leading-none"
                  aria-label="Back to execution paths"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>
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
          <AnimatePresence>
            {guideNotice && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={SPRING_DEFAULT}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full border border-white/15 bg-black/90 backdrop-blur-sm shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
              >
                <span className="text-[11px] font-mono text-white/80 whitespace-nowrap">{guideNotice}</span>
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
                guideNodeId={activeGuideNodeId}
                guideExplanation={guide.explanation}
                guideChanges={activeGuideChanges}
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
        onSelectOrphanNode={handleSelectOrphanNode}
        onStartGuide={handleStartGuide}
        guides={savedGuides}
        onOpenGuide={handleOpenGuide}
        graphData={graphData}
      />
    </div>
  );
}
