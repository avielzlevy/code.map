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
    <div className="w-80 h-screen border-r border-white/10 bg-black/80 backdrop-blur-3xl flex flex-col pt-6 shrink-0 relative z-20 shadow-[4px_0_30px_rgba(0,0,0,0.8)]">
      <div className="px-6 pb-6 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-white/5 rounded-md border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">code-map</h1>
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
