"use client";

import { motion } from "framer-motion";
import { ExecutionPath } from "@/lib/mockData";
import { ChevronRight, Search } from "lucide-react";
import clsx from "clsx";

interface SwitchboardProps {
  paths: ExecutionPath[];
  selectedPath: ExecutionPath | null;
  onSelectPath: (path: ExecutionPath) => void;
  usingMockData?: boolean;
}

export function Switchboard({ paths, selectedPath, onSelectPath, usingMockData }: SwitchboardProps) {
  return (
    <div className="w-80 h-screen border-r border-white/10 bg-black/80 backdrop-blur-3xl flex flex-col shrink-0 relative z-20 shadow-[4px_0_30px_rgba(0,0,0,0.8)]">
      {/* Topbar */}
      <div className="w-full px-5 py-4 border-b border-white/6 shrink-0 flex items-center gap-3">

        {/* Logomark: fn node — hover to glow, no idle animation */}
        <motion.div
          className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
          style={{ borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)" }}
          whileHover={{ borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.1)", boxShadow: "0 0 14px rgba(255,255,255,0.12)" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          <span className="font-mono text-[11px] font-bold text-white/70 tracking-tighter">fn</span>
        </motion.div>

        {/* Wordmark */}
        <div className="flex flex-col justify-center gap-0.75">
          <span className="font-mono text-[15px] font-bold tracking-tight text-white leading-none">
            code<span className="text-white/40">.</span>map
          </span>
          <span className="font-mono text-[11px] tracking-[0.2em] text-white/30 uppercase leading-none">
            execution flow
          </span>
        </div>
      </div>

      {/* Search trigger — teaches ⌘K shortcut */}
      <div className="px-3 py-2 shrink-0">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          aria-label="Search (⌘K)"
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-white/6 bg-white/2 hover:bg-white/5 hover:border-white/10 active:bg-white/7 transition-colors text-gray-600 hover:text-gray-400"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <kbd className="text-[11px] font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-600">⌘K</kbd>
        </button>
      </div>

      {usingMockData && (
        <div className="px-4 py-1.5 shrink-0 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 shrink-0" />
          <span className="text-[11px] font-mono text-yellow-600/70">demo data · backend offline</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        <ul className="space-y-1 px-3">
          {paths.map((path) => {
            const isSelected = selectedPath?.endpoint === path.endpoint && selectedPath?.method === path.method;
            return (
              <li key={`${path.method}:${path.endpoint}`}>
                <button
                  onClick={() => onSelectPath(path)}
                  aria-current={isSelected ? "true" : undefined}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left border",
                    isSelected
                      ? "bg-white/6 border-white/20 text-white shadow-[inset_2px_0_0_0_rgba(255,255,255,0.35)]"
                      : "border-transparent text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span
                    className={clsx(
                      "text-[11px] font-mono px-2 py-0.5 rounded flex items-center shrink-0 font-bold",
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
                  {isSelected && <ChevronRight className="w-4 h-4 text-white/50 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
