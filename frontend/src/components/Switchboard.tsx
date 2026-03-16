"use client";

import { motion } from "framer-motion";
import { ExecutionPath } from "@/lib/mockData";
import { Search } from "lucide-react";
import clsx from "clsx";

interface SwitchboardProps {
  paths: ExecutionPath[];
  selectedPath: ExecutionPath | null;
  onSelectPath: (path: ExecutionPath) => void;
  usingMockData?: boolean;
}

export function Switchboard({ paths, selectedPath, onSelectPath, usingMockData }: SwitchboardProps) {
  return (
    <div className="w-full h-12 border-b border-white/10 bg-black flex items-center shrink-0 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-full border-r border-white/10 shrink-0">
        <motion.div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)" }}
          whileHover={{ borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.09)", boxShadow: "0 0 12px rgba(255,255,255,0.1)" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          <span className="font-mono text-[10px] font-bold text-white/70 tracking-tighter">fn</span>
        </motion.div>
        <span className="font-mono text-[13px] font-bold tracking-tight text-white leading-none select-none">
          code<span className="text-white/35">.</span>map
        </span>
      </div>

      {/* Endpoint tabs — horizontally scrollable */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden h-full flex items-center px-2 gap-0.5 scrollbar-hide">
        {paths.map((path) => {
          const isSelected = selectedPath?.endpoint === path.endpoint && selectedPath?.method === path.method;
          return (
            <motion.button
              key={`${path.method}:${path.endpoint}`}
              onClick={() => onSelectPath(path)}
              aria-current={isSelected ? "true" : undefined}
              className={clsx(
                "relative flex items-center gap-2 px-3 h-8 rounded-md text-xs shrink-0 border font-mono overflow-hidden",
                isSelected
                  ? "border-white/15 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
              whileHover={isSelected ? {} : { backgroundColor: "rgba(255,255,255,0.05)" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
            >
              {isSelected && (
                <motion.div
                  layoutId="active-tab-bg"
                  className="absolute inset-0 rounded-md bg-white/8 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.3)]"
                  transition={{ type: "spring", damping: 28, stiffness: 280 }}
                />
              )}
              <span
                className={clsx(
                  "relative z-10 text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0",
                  path.method === "POST" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                  path.method === "GET"  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                  path.method === "PUT"  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                  "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                )}
              >
                {path.method}
              </span>
              <span className={clsx("relative z-10 truncate max-w-[180px]", isSelected ? "text-white" : "")} title={path.endpoint}>
                {path.endpoint}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 px-3 h-full border-l border-white/10 shrink-0">
        {usingMockData && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 shrink-0"
            title="demo data · backend offline"
          />
        )}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          aria-label="Search (⌘K)"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/12 active:bg-white/8 transition-colors text-gray-500 hover:text-gray-300"
        >
          <Search className="w-3 h-3 shrink-0" />
          <kbd className="text-[11px] font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-600">⌘K</kbd>
        </button>
      </div>
    </div>
  );
}
