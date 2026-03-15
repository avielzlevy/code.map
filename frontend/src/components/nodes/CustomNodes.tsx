import { Handle, Position } from "@xyflow/react";
import { FunctionSquare, Layers } from "lucide-react";

export function StandardNode({ data }: any) {
  return (
    <div
      title={data.hasDetail ? "Double-click to explore" : undefined}
      className={`px-5 py-4 rounded-xl bg-white/5 backdrop-blur-xl border w-[450px] transition-all group relative
        ${data.hasDetail
          ? "border-white/20 hover:border-white/40 cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.6),0_0_15px_rgba(255,255,255,0.05)]"
          : "border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
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
        className="!w-2.5 !h-2.5 !border-2 !border-black !bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
      />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/5 rounded-lg border border-white/10">
          <FunctionSquare className="w-5 h-5 text-gray-300" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[15px] font-semibold text-white tracking-wide truncate pr-6">{data.funcName}</span>
          <span className="text-[11px] text-gray-400 font-mono truncate mt-0.5">
            {data.fileName.split("/").pop()}
          </span>
        </div>
      </div>
      {data.docstring && (
        <div className="mt-3 text-[11px] font-mono font-medium bg-white/5 border border-white/10 text-gray-300 px-2 py-1 rounded-md flex items-center gap-1.5 overflow-hidden">
          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-white/60" />
          <span className="truncate">{data.docstring.split("\n")[0].replace(/^\s*\/?\*+\s*/, "").trim()}</span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        data-connected={data.hasOutgoing ? "true" : "false"}
        className="!w-2.5 !h-2.5 !border-2 !border-black !bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
      />
    </div>
  );
}

export function EnhancedNode({ data }: any) {
  return (
    <div
      title={data.hasDetail ? "Double-click to explore" : undefined}
      className={`px-5 py-4 rounded-xl bg-black/40 backdrop-blur-xl border w-[450px] relative group transition-all
        ${data.hasDetail
          ? "border-emerald-500/50 hover:border-emerald-400 cursor-pointer shadow-[0_4px_30px_rgba(16,185,129,0.2),0_0_15px_rgba(16,185,129,0.1)]"
          : "border-emerald-500/30 hover:border-emerald-500/40 shadow-[0_4px_30px_rgba(16,185,129,0.15)]"
        }`}
    >
      {/* Decorative overlays isolated so they don't clip handles */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60" />
      </div>

      {data.stepNumber != null && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-emerald-400 z-20 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
          {data.stepNumber}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        data-connected={data.hasIncoming ? "true" : "false"}
        className="!w-2.5 !h-2.5 !border-2 !border-black !bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)] z-20"
      />
      <div className="flex items-center gap-3 relative z-10">
        <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          <FunctionSquare className="w-5 h-5" />
        </div>
        <div className="flex flex-col flex-1">
          <span className="text-[15px] font-semibold text-emerald-300 tracking-wide">{data.funcName}</span>
          <span className="text-[11px] text-gray-400 font-mono truncate mt-0.5">
            {data.fileName.split("/").pop()}
          </span>
        </div>
      </div>
      {data.intentTag && (
        <div className="mt-3 relative z-10 text-[11px] font-mono font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2 py-1 rounded-md flex items-center gap-1.5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] overflow-hidden">
          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <span className="truncate">{data.intentTag}</span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        data-connected={data.hasOutgoing ? "true" : "false"}
        className="!w-2.5 !h-2.5 !border-2 !border-black !bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)] z-20"
      />
    </div>
  );
}
