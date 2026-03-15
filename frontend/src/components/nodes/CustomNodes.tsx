import { Handle, Position } from "@xyflow/react";
import { FunctionSquare, Sparkles, ChevronRight } from "lucide-react";

export function StandardNode({ data }: any) {
  return (
    <div className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)] rounded-xl bg-[#13151a] border min-w-[240px] transition-all group relative
      ${data.hasDetail
        ? "border-[#3b82f6]/40 hover:border-[#3b82f6] hover:shadow-[0_4px_24px_rgba(59,130,246,0.2)] cursor-pointer"
        : "border-[#2a2f3a] hover:border-[#2a2f3a]/80"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all group-hover:scale-125"
      />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#1e222a] rounded-lg border border-[#2a2f3a]">
          <FunctionSquare className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex flex-col flex-1">
          <span className="text-[15px] font-semibold text-gray-200 tracking-wide">{data.funcName}</span>
          <span className="text-[11px] text-gray-500 font-mono truncate max-w-[150px] mt-0.5">
            {data.fileName.split("/").pop()}
          </span>
        </div>
        {data.hasDetail && (
          <ChevronRight className="w-4 h-4 text-[#3b82f6] opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all group-hover:scale-125"
      />
    </div>
  );
}

export function EnhancedNode({ data }: any) {
  return (
    <div className={`px-5 py-4 shadow-[0_4px_30px_rgba(16,185,129,0.15)] rounded-xl bg-[#13151a] border min-w-[240px] relative overflow-hidden group transition-all
      ${data.hasDetail
        ? "border-[#10b981]/60 hover:border-[#10b981] hover:shadow-[0_4px_30px_rgba(16,185,129,0.3)] cursor-pointer"
        : "border-[#10b981]/40 hover:border-[#10b981]"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#10b981]/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#10b981] to-transparent opacity-50" />

      {data.stepNumber != null && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center text-[10px] font-bold text-[#10b981] z-20">
          {data.stepNumber}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-all group-hover:scale-125 z-20"
      />
      <div className="flex items-center gap-3 relative z-10">
        <div className="p-2 bg-[#10b981]/10 rounded-lg border border-[#10b981]/30 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex flex-col flex-1">
          <span className="text-[15px] font-semibold text-[#10b981] tracking-wide">{data.funcName}</span>
          <span className="text-[11px] text-gray-400 font-mono truncate max-w-[150px] mt-0.5">
            {data.fileName.split("/").pop()}
          </span>
        </div>
        {data.hasDetail && (
          <ChevronRight className="w-4 h-4 text-[#10b981] opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
      {data.intentTag && (
        <div className="mt-3 relative z-10 text-[11px] font-mono font-medium bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] px-2 py-1 rounded-md inline-flex items-center gap-1.5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
          {data.intentTag}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-all group-hover:scale-125 z-20"
      />
    </div>
  );
}
