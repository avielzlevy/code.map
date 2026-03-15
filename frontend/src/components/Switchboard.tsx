"use client";

import { ExecutionPath } from "@/lib/mockData";
import { Network, ChevronRight } from "lucide-react";
import clsx from "clsx";

interface SwitchboardProps {
  paths: ExecutionPath[];
  selectedPath: ExecutionPath | null;
  onSelectPath: (path: ExecutionPath) => void;
}

export function Switchboard({ paths, selectedPath, onSelectPath }: SwitchboardProps) {
  return (
    <div className="w-80 h-screen border-r border-white/10 bg-black/80 backdrop-blur-3xl flex flex-col pt-6 shrink-0 relative z-20 shadow-[4px_0_30px_rgba(0,0,0,0.8)]">
      {/* Hyper-Creative Flashy Topbar */}
      <div className="w-full relative py-10 flex flex-col items-center justify-center border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden shrink-0">
        
        {/* Dynamic Background Effects */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Radial gradient glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 blur-[60px] rounded-full" />
          
          {/* Animated data lines */}
          <div className="absolute top-0 left-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent" />
          <div className="absolute top-0 right-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-blue-500/20 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-5 w-full px-6">
          
          {/* Custom Animated Logo Icon: "The Data Nexus" */}
          <div className="relative w-14 h-14 flex items-center justify-center group flex-shrink-0 cursor-pointer">
            {/* Outer stabilizing glass ring */}
            <div className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md transition-all duration-700 group-hover:bg-white/[0.05] group-hover:border-white/20 group-hover:rotate-12 group-hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,1)]" />
            
            {/* Rotating UI Elements */}
            <div className="absolute inset-2 border border-dashed border-emerald-500/40 rounded-full animate-[spin_6s_linear_infinite]" />
            <div className="absolute inset-[10px] border-t-2 border-transparent border-t-blue-400 rounded-full animate-[spin_3s_linear_infinite]" />
            <div className="absolute inset-[10px] border-b-2 border-transparent border-b-purple-400 rounded-full animate-[spin_4s_linear_infinite_reverse]" />
            
            {/* Central Glowing Core */}
            <div className="w-3 h-3 bg-white rounded-sm rotate-45 shadow-[0_0_20px_rgba(255,255,255,0.9)] transition-all duration-500 group-hover:scale-150 group-hover:bg-emerald-300 group-hover:shadow-[0_0_30px_rgba(16,185,129,1)]" />
          </div>

          <div className="flex flex-col items-center w-full">
            <h1 className="text-3xl font-black tracking-tighter text-white leading-none flex items-center gap-1.5 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              code
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
              map
            </h1>
            
            {/* High-tech aesthetic underline */}
            <div className="mt-4 flex items-center justify-center gap-1.5 w-full opacity-70">
              <span className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-emerald-500/50" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              <span className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-emerald-500/50" />
            </div>
          </div>
        </div>
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
                      ? "bg-white/10 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1),inset_2px_0_0_0_#ffffff]"
                      : "border-transparent text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span
                    className={clsx(
                      "text-[10px] font-mono px-2 py-0.5 rounded flex items-center shrink-0 font-bold",
                      path.method === "POST" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]" :
                      path.method === "GET" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]" :
                      path.method === "PUT" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]" :
                      "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                    )}
                  >
                    {path.method}
                  </span>
                  <span className={clsx("truncate flex-1 font-medium", isSelected ? "text-white" : "")}>
                    {path.endpoint}
                  </span>
                  {isSelected && <ChevronRight className="w-4 h-4 text-white shrink-0 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
