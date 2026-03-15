import { Handle, Position } from "@xyflow/react";
import { FunctionSquare, Sparkles } from "lucide-react";

export function StandardNode({ data }: any) {
  return (
    <div className="px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)] rounded-xl bg-[#13151a] border border-[#2a2f3a] min-w-[240px] transition-all hover:border-[#3b82f6]/50 hover:shadow-[0_4px_24px_rgba(59,130,246,0.15)] group">
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all group-hover:scale-125" 
      />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#1e222a] rounded-lg border border-[#2a2f3a]">
          <FunctionSquare className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold text-gray-200 tracking-wide">{data.funcName}</span>
          <span className="text-[11px] text-gray-500 font-mono truncate max-w-[150px] mt-0.5">
            {data.fileName.split('/').pop()}
          </span>
        </div>
      </div>
      {!data.isLeaf && (
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all group-hover:scale-125" 
        />
      )}
    </div>
  );
}

export function EnhancedNode({ data }: any) {
  return (
    <div className="px-5 py-4 shadow-[0_4px_30px_rgba(16,185,129,0.15)] rounded-xl bg-[#13151a] border border-[#10b981]/40 min-w-[240px] relative overflow-hidden group hover:border-[#10b981] transition-all">
      {/* Subtle Glow background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#10b981]/5 to-transparent pointer-events-none" />
      
      {/* Top highlight line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#10b981] to-transparent opacity-50" />
      
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-all group-hover:scale-125 z-20" 
      />
      <div className="flex items-center gap-3 relative z-10">
        <div className="p-2 bg-[#10b981]/10 rounded-lg border border-[#10b981]/30 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold text-[#10b981] tracking-wide">{data.funcName}</span>
          <span className="text-[11px] text-gray-400 font-mono truncate max-w-[150px] mt-0.5">
            {data.fileName.split('/').pop()}
          </span>
        </div>
      </div>
      {data.intentTag && (
        <div className="mt-3 relative z-10 text-[11px] font-mono font-medium bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] px-2 py-1 rounded-md inline-flex items-center gap-1.5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
          {data.intentTag}
        </div>
      )}
      {!data.isLeaf && (
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="!w-3 !h-3 !border-2 !border-[#13151a] !bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-all group-hover:scale-125 z-20" 
        />
      )}
    </div>
  );
}
