import { Handle, Position } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import { FunctionSquare, Layers, CornerLeftUp, ChevronDown, Sparkles, ExternalLink } from "lucide-react";
import type { FlowNode } from "@/lib/mockData";
import { getVSCodeUrl } from "@/lib/deep-link";
import { SPRING_STANDARD, SPRING_BADGE, SPRING_DEFAULT } from "@/lib/spring";

type NodeProps = FlowNode & {
  hasIncoming: boolean;
  hasOutgoing: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDrillDown: () => void;
};
type GhostPinData = { callerLabel: string; onBack?: () => void };

export function GhostEntryPin({ data }: { data: GhostPinData }) {
  const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    data.onBack?.();
  };
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex items-center select-none cursor-pointer group outline-none"
      onClick={handleActivate}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleActivate(e)}
    >
      {/* Callout box — React Flow's dashed edge provides the visual connector */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 bg-zinc-950 group-hover:border-white/20 group-hover:bg-white/5 transition-[border-color,background-color] duration-150 max-w-xs overflow-hidden">
        <CornerLeftUp className="w-3 h-3 -scale-x-100 text-white/25 group-hover:text-white/55 transition-colors duration-150 shrink-0" />
        <span className="font-mono text-[11px] min-w-0 flex items-center gap-1 overflow-hidden">
          <span className="text-white/30 group-hover:text-white/55 transition-colors duration-150 shrink-0">called by:</span>
          <span className="text-white/45 group-hover:text-white/80 transition-colors duration-150 truncate max-w-40" title={data.callerLabel}>{data.callerLabel}</span>
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}

/** Inline expansion panel — slides open below the node card. */
function NodeExpansion({ data, amber }: { data: NodeProps; amber?: boolean }) {
  return (
    <motion.div
      key="expansion"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={SPRING_DEFAULT}
      className="overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* Full file path + line — supplements the short filename in the header */}
      <div className={`px-5 pt-3 pb-2 border-t ${amber ? "border-amber-500/15" : "border-white/8"}`}>
        <span className="font-mono text-[11px] text-gray-500 break-all leading-snug">
          {data.fileName}:{data.line}
        </span>
      </div>

      {/* Docstring */}
      {data.docstring && (
        <div className="px-5 pb-3">
          <pre
            className={`text-[11px] font-mono whitespace-pre-wrap leading-relaxed border-l-2 pl-3 ${
              amber ? "text-amber-300/70 border-amber-500/30" : "text-gray-400 border-white/15"
            }`}
          >
            {data.docstring}
          </pre>
        </div>
      )}

      {/* AI summary */}
      {data.aiSummary && (
        <div className="px-5 pb-3">
          <div
            className={`relative p-3 rounded-lg border ${
              amber ? "bg-amber-500/5 border-amber-500/15" : "bg-white/3 border-white/8"
            }`}
          >
            <Sparkles
              className={`absolute top-2.5 right-2.5 w-3 h-3 ${
                amber ? "text-amber-400/30" : "text-white/20"
              }`}
            />
            <p className="text-[12px] text-gray-400 leading-relaxed pr-5 break-words">{data.aiSummary}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 px-5 pb-3">
        {data.hasDetail && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDrillDown();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white text-black py-2 px-3 rounded-md text-[12px] font-semibold hover:bg-white/90 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            Drill into calls
          </button>
        )}
        <a
          href={getVSCodeUrl(data.fileName, data.line)}
          rel="noopener"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 flex items-center justify-center gap-1.5 border border-white/15 hover:border-white/40 text-gray-400 hover:text-white py-2 px-3 rounded-md text-[12px] font-medium hover:bg-white/5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in VS Code
        </a>
      </div>
    </motion.div>
  );
}

export function StandardNode({ data }: { data: NodeProps }) {
  return (
    <motion.div
      className={`rounded-xl bg-zinc-950 border w-112.5 group relative
        ${data.hasDetail
          ? "border-white/20 hover:border-white/40 cursor-pointer transition-colors"
          : "border-white/10 transition-colors shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
        }`}
      initial="rest"
      whileHover={data.hasDetail ? "hover" : undefined}
      animate="rest"
      variants={data.hasDetail ? {
        rest: { y: 0, boxShadow: "0 4px 24px rgba(0,0,0,0.6), 2px 4px 0 -1px rgba(255,255,255,0.07), 5px 8px 0 -2px rgba(255,255,255,0.035)" },
        hover: { y: -3, boxShadow: "0 4px 24px rgba(0,0,0,0.6), 3px 5px 0 -1px rgba(255,255,255,0.11), 6px 10px 0 -2px rgba(255,255,255,0.055)" },
      } : {
        rest: { y: 0 },
      }}
      transition={SPRING_STANDARD}
    >
      {data.hasDetail && (
        <motion.div
          variants={{
            rest: { scale: 1, opacity: 1 },
            hover: { scale: 1.15, opacity: 1 },
          }}
          transition={SPRING_BADGE}
          title="Double-click to drill into sub-calls"
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/22 border border-white/45 flex items-center justify-center z-20"
        >
          <Layers className="w-3.5 h-3.5 text-white/80" />
        </motion.div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        data-connected={data.hasIncoming ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-white! shadow-[0_0_6px_rgba(255,255,255,0.3)]"
      />

      {/* Main content */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 rounded-lg border border-white/10">
            <FunctionSquare className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-base font-semibold text-white truncate pr-7" title={data.funcName}>{data.funcName}</span>
            <span className="text-[11px] text-gray-400 font-mono truncate mt-0.5" title={data.fileName}>
              {data.fileName.split("/").pop() ?? data.fileName}
            </span>
          </div>
        </div>
        {data.docstring && (
          <div className={`mt-3 text-[11px] font-mono font-medium bg-white/5 border border-white/10 text-gray-400 px-2 py-1 rounded-md flex items-start gap-1.5 ${data.isExpanded ? "" : "overflow-hidden"}`}>
            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-white/60 mt-0.75" />
            <span className={data.isExpanded ? "whitespace-pre-wrap wrap-break-word" : "truncate"} title={data.isExpanded ? undefined : data.docstring}>
              {data.isExpanded ? data.docstring : data.docstring.split("\n")[0].replace(/^\s*\/?\*+\s*/, "").trim()}
            </span>
          </div>
        )}
      </div>

      {/* Drill hint — fades in on hover for drillable nodes; absolute so it doesn't affect node height */}
      {data.hasDetail && !data.isExpanded && (
        <motion.div
          variants={{
            rest: { opacity: 0 },
            hover: { opacity: 1 },
          }}
          transition={SPRING_STANDARD}
          className="absolute bottom-7 left-0 right-0 px-5 pb-2 flex items-center gap-1.5 pointer-events-none"
        >
          <Layers className="w-3 h-3 text-white/25" />
          <span className="text-[10px] font-mono text-white/25 tracking-wide">double-click to drill</span>
        </motion.div>
      )}

      <AnimatePresence>
        {data.isExpanded && <NodeExpansion data={data} />}
      </AnimatePresence>

      {/* Chevron toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); data.onToggleExpand(); }}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={data.isExpanded ? "Collapse details" : "Expand details"}
        className="w-full h-7 border-t border-white/8 hover:bg-white/4 transition-colors rounded-b-xl flex items-center justify-center overflow-hidden"
      >
        <motion.div animate={{ rotate: data.isExpanded ? 180 : 0 }} transition={SPRING_DEFAULT}>
          <ChevronDown className={`w-3.5 h-3.5 transition-colors ${data.isExpanded ? "text-white/60" : "text-white/25"}`} />
        </motion.div>
      </button>

      <Handle
        type="source"
        position={Position.Right}
        data-connected={data.hasOutgoing ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-white! shadow-[0_0_6px_rgba(255,255,255,0.3)]"
      />
    </motion.div>
  );
}

export function EnhancedNode({ data }: { data: NodeProps }) {
  return (
    <motion.div
      className={`rounded-xl bg-zinc-950 border w-112.5 relative group
        ${data.hasDetail
          ? "border-amber-500/50 hover:border-amber-400 cursor-pointer transition-colors"
          : "border-amber-500/30 hover:border-amber-500/40 transition-colors shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
        }`}
      initial="rest"
      whileHover={data.hasDetail ? "hover" : undefined}
      animate="rest"
      variants={data.hasDetail ? {
        rest: { y: 0, boxShadow: "0 4px 30px rgba(245,158,11,0.12), 2px 4px 0 -1px rgba(245,158,11,0.10), 5px 8px 0 -2px rgba(245,158,11,0.05)" },
        hover: { y: -3, boxShadow: "0 4px 30px rgba(245,158,11,0.18), 3px 5px 0 -1px rgba(245,158,11,0.15), 6px 10px 0 -2px rgba(245,158,11,0.07)" },
      } : {
        rest: { y: 0 },
      }}
      transition={SPRING_STANDARD}
    >
      {/* Gradient tint — distinguishes enhanced nodes from standard */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-linear-to-br from-amber-500/8 to-transparent" />
      </div>

      {data.hasDetail && (
        <motion.div
          variants={{
            rest: { scale: 1, opacity: 1 },
            hover: { scale: 1.15, opacity: 1 },
          }}
          transition={SPRING_BADGE}
          title="Double-click to drill into sub-calls"
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-amber-500/32 border border-amber-500/60 flex items-center justify-center z-20"
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
        </motion.div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        data-connected={data.hasIncoming ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-amber-400! shadow-[0_0_8px_rgba(245,158,11,0.5)] z-20"
      />

      {/* Main content */}
      <div className="px-5 pt-4 pb-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30 text-amber-400">
            <FunctionSquare className="w-5 h-5" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-base font-semibold text-amber-300 truncate pr-7" title={data.funcName}>{data.funcName}</span>
            <span className="text-[11px] text-gray-400 font-mono truncate mt-0.5" title={data.fileName}>
              {data.fileName.split("/").pop() ?? data.fileName}
            </span>
          </div>
        </div>
        {data.intentTag && (
          <div className={`mt-3 text-[11px] font-mono font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-1 rounded-md flex items-start gap-1.5 ${data.isExpanded ? "" : "overflow-hidden"}`}>
            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.4)] mt-0.75" />
            <span className={data.isExpanded ? "wrap-break-word" : "truncate"} title={data.isExpanded ? undefined : data.intentTag}>{data.intentTag}</span>
          </div>
        )}
      </div>

      {/* Drill hint — fades in on hover for drillable enhanced nodes; absolute so it doesn't affect node height */}
      {data.hasDetail && !data.isExpanded && (
        <motion.div
          variants={{
            rest: { opacity: 0 },
            hover: { opacity: 1 },
          }}
          transition={SPRING_STANDARD}
          className="absolute bottom-7 left-0 right-0 px-5 pb-2 flex items-center gap-1.5 z-10 pointer-events-none"
        >
          <Layers className="w-3 h-3 text-amber-500/35" />
          <span className="text-[10px] font-mono text-amber-500/35 tracking-wide">double-click to drill</span>
        </motion.div>
      )}

      <AnimatePresence>
        {data.isExpanded && <NodeExpansion data={data} amber />}
      </AnimatePresence>

      {/* Chevron toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); data.onToggleExpand(); }}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={data.isExpanded ? "Collapse details" : "Expand details"}
        className="relative z-10 w-full h-7 border-t border-amber-500/15 hover:bg-amber-500/5 transition-colors rounded-b-xl flex items-center justify-center overflow-hidden"
      >
        <motion.div animate={{ rotate: data.isExpanded ? 180 : 0 }} transition={SPRING_DEFAULT}>
          <ChevronDown className={`w-3.5 h-3.5 transition-colors ${data.isExpanded ? "text-amber-400/60" : "text-amber-500/30"}`} />
        </motion.div>
      </button>

      <Handle
        type="source"
        position={Position.Right}
        data-connected={data.hasOutgoing ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-amber-400! shadow-[0_0_8px_rgba(245,158,11,0.5)] z-20"
      />
    </motion.div>
  );
}
