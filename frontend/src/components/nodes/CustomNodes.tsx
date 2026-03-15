import { Handle, Position } from "@xyflow/react";
import { FunctionSquare, Sparkles, Layers } from "lucide-react";

export function StandardNode({ data }: any) {
  return (
    <div
      title={data.hasDetail ? "Double-click to explore" : undefined}
      className={`px-5 py-4 rounded-xl bg-[#13151a] border w-[450px] transition-all group relative
        ${data.hasDetail
          ? "border-[#3b82f6]/50 hover:border-[#3b82f6] cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.4),5px_7px_0_0_rgba(59,130,246,0.18),9px_13px_0_0_rgba(59,130,246,0.09)]"
          : "border-[#2a2f3a] shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
        }`}
    >
      {data.hasDetail && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#3b82f6]/20 border border-[#3b82f6]/40 flex items-center justify-center z-20">
          <Layers className="w-3 h-3 text-[#3b82f6]" />
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        data-connected={data.hasIncoming ? "true" : "false"}
        className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)]"
      />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#1e222a] rounded-lg border border-[#2a2f3a]">
          <FunctionSquare className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[15px] font-semibold text-gray-200 tracking-wide truncate pr-6">{data.funcName}</span>
          <span className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
            {data.fileName.split("/").pop()}
          </span>
        </div>
      </div>
      {data.docstring && (
        <div className="mt-3 text-[11px] font-mono font-medium bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#3b82f6] px-2 py-1 rounded-md flex items-center gap-1.5 overflow-hidden">
          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#3b82f6]" />
          <span className="truncate">{data.docstring.split("\n")[0].replace(/^\s*\/?\*+\s*/, "").trim()}</span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        data-connected={data.hasOutgoing ? "true" : "false"}
        className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)]"
      />
    </div>
  );
}

export function EnhancedNode({ data }: any) {
  return (
    <div
      title={data.hasDetail ? "Double-click to explore" : undefined}
      className={`px-5 py-4 rounded-xl bg-[#13151a] border w-[450px] relative group transition-all
        ${data.hasDetail
          ? "border-[#10b981]/60 hover:border-[#10b981] cursor-pointer shadow-[0_4px_30px_rgba(16,185,129,0.15),5px_7px_0_0_rgba(16,185,129,0.12),9px_13px_0_0_rgba(16,185,129,0.06)]"
          : "border-[#10b981]/40 hover:border-[#10b981] shadow-[0_4px_30px_rgba(16,185,129,0.15)]"
        }`}
    >
      {/* Decorative overlays isolated so they don't clip handles */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#10b981]/5 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#10b981] to-transparent opacity-50" />
      </div>

      {data.stepNumber != null && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center text-[10px] font-bold text-[#10b981] z-20">
          {data.stepNumber}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        data-connected={data.hasIncoming ? "true" : "false"}
        className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.8)] z-20"
      />
      <div className="flex items-center gap-3 relative z-10">
        <div className="p-2 bg-[#10b981]/10 rounded-lg border border-[#10b981]/30 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex flex-col flex-1">
          <span className="text-[15px] font-semibold text-[#10b981] tracking-wide">{data.funcName}</span>
          <span className="text-[11px] text-gray-400 font-mono truncate mt-0.5">
            {data.fileName.split("/").pop()}
          </span>
        </div>
      </div>
      {data.intentTag && (
        <div className="mt-3 relative z-10 text-[11px] font-mono font-medium bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] px-2 py-1 rounded-md flex items-center gap-1.5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] overflow-hidden">
          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#10b981] animate-pulse" />
          <span className="truncate">{data.intentTag}</span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        data-connected={data.hasOutgoing ? "true" : "false"}
        className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.8)] z-20"
      />
    </div>
  );
}
