import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import { FunctionSquare, Layers, CornerLeftUp } from "lucide-react";

export function GhostEntryPin({ data }: any) {
  return (
    <div
      className="flex flex-col items-center select-none cursor-pointer group"
      style={{ width: 450 }}
      onClick={(e) => { e.stopPropagation(); data.onBack?.(); }}
    >
      {/* Dashed line going up off-screen */}
      <div className="w-px h-12 border-l-2 border-dashed border-white/15 group-hover:border-white/40 transition-colors duration-150" />

      {/* The chip */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-zinc-950 group-hover:border-white/30 group-hover:bg-white/6 transition-[border-color,background-color] duration-150">
        <CornerLeftUp className="w-3 h-3 -scale-x-100 text-white/30 group-hover:text-white/70 transition-colors duration-150" />
        <span className="font-mono text-[11px] tracking-wide">
          <span className="text-white/35 group-hover:text-white/70 transition-colors duration-150">called by: </span>
          <span className="text-white/55 group-hover:text-white/90 transition-colors duration-150">{data.callerLabel}</span>
        </span>
      </div>

      {/* Connector down to the root node */}
      <div className="w-px h-6 border-l-2 border-dashed border-white/15 group-hover:border-white/40 transition-colors duration-150" />

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}

export function StandardNode({ data }: any) {
  return (
    <div
      className={`px-5 py-4 rounded-xl bg-zinc-950 border w-112.5 group relative
        ${data.hasDetail
          ? "border-white/20 hover:border-white/40 cursor-pointer transition-[border-color,box-shadow] duration-200 shadow-[0_4px_24px_rgba(0,0,0,0.6)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.6),3px_4px_0_-1px_rgba(255,255,255,0.04),6px_8px_0_-2px_rgba(255,255,255,0.02)]"
          : "border-white/10 transition-colors shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
        }`}
    >
      {data.hasDetail && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center z-20">
          <Layers className="w-3 h-3 text-white/80" />
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        data-connected={data.hasIncoming ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-white! shadow-[0_0_8px_rgba(255,255,255,0.6)]"
      />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/5 rounded-lg border border-white/10">
          <FunctionSquare className="w-5 h-5 text-gray-300" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-base font-semibold text-white tracking-wide truncate pr-6" title={data.funcName}>{data.funcName}</span>
          <span className="text-[11px] text-gray-400 font-mono truncate mt-0.5" title={data.fileName}>
            {data.fileName.split("/").pop()}
          </span>
        </div>
      </div>
      {data.docstring && (
        <div className="mt-3 text-[11px] font-mono font-medium bg-white/5 border border-white/10 text-gray-300 px-2 py-1 rounded-md flex items-center gap-1.5 overflow-hidden">
          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-white/60" />
          <span className="truncate" title={data.docstring}>{data.docstring.split("\n")[0].replace(/^\s*\/?\*+\s*/, "").trim()}</span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        data-connected={data.hasOutgoing ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-white! shadow-[0_0_8px_rgba(255,255,255,0.6)]"
      />
    </div>
  );
}

export function EnhancedNode({ data }: any) {
  return (
    <div
      className={`px-5 py-4 rounded-xl bg-zinc-950 border w-112.5 relative group
        ${data.hasDetail
          ? "border-amber-500/50 hover:border-amber-400 cursor-pointer transition-[border-color,box-shadow] duration-200 shadow-[0_4px_30px_rgba(245,158,11,0.15),0_0_15px_rgba(245,158,11,0.08)] hover:shadow-[0_4px_30px_rgba(245,158,11,0.15),0_0_15px_rgba(245,158,11,0.08),3px_4px_0_-1px_rgba(245,158,11,0.05),6px_8px_0_-2px_rgba(245,158,11,0.025)]"
          : "border-amber-500/30 hover:border-amber-500/40 transition-colors shadow-[0_4px_30px_rgba(245,158,11,0.1)]"
        }`}
    >
      {/* Gradient tint — distinguishes enhanced nodes from standard */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-linear-to-br from-amber-500/8 to-transparent" />
      </div>

      {data.hasDetail && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center z-20">
          <Layers className="w-3 h-3 text-amber-400" />
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        data-connected={data.hasIncoming ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-amber-400! shadow-[0_0_12px_rgba(245,158,11,0.7)] z-20"
      />
      <div className="flex items-center gap-3 relative z-10">
        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30 text-amber-400">
          <FunctionSquare className="w-5 h-5" />
        </div>
        <div className="flex flex-col flex-1">
          <span className="text-base font-semibold text-amber-300 tracking-wide">{data.funcName}</span>
          <span className="text-[11px] text-gray-400 font-mono truncate mt-0.5">
            {data.fileName.split("/").pop()}
          </span>
        </div>
      </div>
      {data.intentTag && (
        <div className="mt-3 relative z-10 text-[11px] font-mono font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-1 rounded-md flex items-center gap-1.5 overflow-hidden">
          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.7)]" />
          <span className="truncate" title={data.intentTag}>{data.intentTag}</span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        data-connected={data.hasOutgoing ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-amber-400! shadow-[0_0_12px_rgba(245,158,11,0.7)] z-20"
      />
    </div>
  );
}
