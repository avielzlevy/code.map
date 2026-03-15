"use client";

import { ExecutionPath } from "@/lib/mockData";
import { Network, Activity, ChevronRight } from "lucide-react";
import clsx from "clsx";

interface SwitchboardProps {
  paths: ExecutionPath[];
  selectedPath: ExecutionPath | null;
  onSelectPath: (path: ExecutionPath) => void;
}

export function Switchboard({ paths, selectedPath, onSelectPath }: SwitchboardProps) {
  return (
    <div className="w-80 h-screen border-r border-[#2a2f3a] bg-[#0f1115] flex flex-col pt-6 shrink-0 relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
      <div className="px-6 pb-6 border-b border-[#2a2f3a]">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-[#3b82f6]/10 rounded-md border border-[#3b82f6]/20">
            <Activity className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#e2e8f0]">FlowMap</h1>
        </div>
        <p className="text-sm text-gray-400">Developer Execution Map</p>
      </div>

      <div className="flex-1 overflow-y-auto py-5">
        <div className="px-5 mb-4">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 font-bold flex items-center gap-2">
            <Network className="w-4 h-4" /> Discovered Endpoints
          </h2>
        </div>

        <ul className="space-y-1.5 px-3">
          {paths.map((path) => {
            const isSelected = selectedPath?.endpoint === path.endpoint;
            return (
              <li key={path.endpoint}>
                <button
                  onClick={() => onSelectPath(path)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left border",
                    isSelected
                      ? "bg-gradient-to-r from-[#3b82f6]/20 to-transparent border-[#3b82f6]/30 text-[#e2e8f0] shadow-[inset_2px_0_0_0_#3b82f6]"
                      : "border-transparent text-gray-400 hover:bg-[#1e222a] hover:text-white"
                  )}
                >
                  <span
                    className={clsx(
                      "text-[10px] font-mono px-2 py-0.5 rounded flex items-center shrink-0 font-bold",
                      path.method === "POST" ? "bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20" :
                      path.method === "GET" ? "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20" :
                      path.method === "PUT" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                      "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                    )}
                  >
                    {path.method}
                  </span>
                  <span className={clsx("truncate flex-1 font-medium", isSelected ? "text-[#3b82f6]" : "")}>
                    {path.endpoint}
                  </span>
                  {isSelected && <ChevronRight className="w-4 h-4 text-[#3b82f6] shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
