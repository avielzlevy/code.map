"use client";

import { motion } from "framer-motion";
import { ExecutionPath } from "@/lib/mockData";
import { ChevronRight, Search } from "lucide-react";
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

        {/* Logomark: fn node — hover to glow, no idle animation */}
        <motion.div
          className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
          style={{ borderWidth: 1, borderStyle: "solid", borderColor: "rgba(52, 211, 153, 0.25)", backgroundColor: "rgba(52, 211, 153, 0.07)" }}
          whileHover={{ borderColor: "rgba(52, 211, 153, 0.55)", backgroundColor: "rgba(52, 211, 153, 0.13)", boxShadow: "0 0 14px rgba(52, 211, 153, 0.25)" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          <span className="font-mono text-[11px] font-bold text-emerald-400 tracking-tighter">fn</span>
        </motion.div>

        {/* Wordmark */}
        <div className="flex flex-col justify-center gap-[3px]">
          <span className="font-mono text-[15px] font-bold tracking-tight text-white leading-none">
            code<span className="text-emerald-400">.</span>map
          </span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase leading-none">
            execution flow
          </span>
        </div>
      </div>

      {/* Search trigger — teaches ⌘K shortcut */}
      <div className="px-3 py-2 shrink-0">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 active:bg-white/[0.07] transition-colors text-gray-600 hover:text-gray-400 text-xs"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left font-mono">Search…</span>
          <kbd className="text-[10px] font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-600">⌘K</kbd>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <ul className="space-y-1 px-3">
          {paths.map((path) => {
            const isSelected = selectedPath?.endpoint === path.endpoint;
            return (
              <li key={path.endpoint}>
                <button
                  onClick={() => onSelectPath(path)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left border",
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500/25 text-white shadow-[inset_2px_0_0_0_rgba(16,185,129,0.7)]"
                      : "border-transparent text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span
                    className={clsx(
                      "text-[10px] font-mono px-2 py-0.5 rounded flex items-center shrink-0 font-bold",
                      path.method === "POST" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                      path.method === "GET" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                      path.method === "PUT" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                      "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                    )}
                  >
                    {path.method}
                  </span>
                  <span className={clsx("truncate flex-1 font-medium", isSelected ? "text-white" : "")}>
                    {path.endpoint}
                  </span>
                  {isSelected && <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
