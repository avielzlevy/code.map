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
    <div className="w-80 h-screen border-r border-white/10 bg-black/80 backdrop-blur-3xl flex flex-col shrink-0 relative z-20 shadow-[4px_0_30px_rgba(0,0,0,0.8)]">
      {/* Topbar */}
      <div className="w-full px-5 py-4 border-b border-white/[0.06] shrink-0 flex items-center gap-3">

        {/* Logomark: fn node — mirrors the app's own card language */}
        <div className="w-9 h-9 shrink-0 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] flex items-center justify-center animate-[glow-pulse_3s_ease-in-out_infinite]">
          <span className="font-mono text-[11px] font-bold text-emerald-400 tracking-tighter">fn</span>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col justify-center gap-[3px]">
          <span className="font-mono text-[15px] font-bold tracking-tight text-white leading-none">
            code<span className="text-emerald-400">.</span>map
          </span>
          <span className="font-mono text-[8px] tracking-[0.22em] text-white/25 uppercase leading-none">
            execution flow
          </span>
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
