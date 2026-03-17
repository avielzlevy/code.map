"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { ExecutionPath } from "@/lib/mockData";
import clsx from "clsx";
import { SPRING_DEFAULT, SPRING_STANDARD } from "@/lib/spring";
import Image from "next/image";

interface SwitchboardProps {
  paths: ExecutionPath[];
  selectedPath: ExecutionPath | null;
  onSelectPath: (path: ExecutionPath) => void;
}

export function Switchboard({
  paths,
  selectedPath,
  onSelectPath,
}: SwitchboardProps) {
  return (
    <div className="w-full h-12 border-b border-white/10 bg-black flex items-center shrink-0 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
      {/* Logo */}
      <div className="flex items-center px-4 h-full border-r border-white/10 shrink-0">
        <Image
          src="/code.map-logo.png"
          alt="code.map"
          width={96}
          height={24}
          className="h-5 w-auto select-none"
          priority
        />
      </div>

      {/* Endpoint tabs — horizontally scrollable */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden h-full flex items-center px-2 gap-0.5 scrollbar-hide">
        {paths.map((path) => {
          const isSelected =
            selectedPath?.endpoint === path.endpoint &&
            selectedPath?.method === path.method;
          return (
            <motion.button
              key={`${path.method}:${path.endpoint}`}
              onClick={() => onSelectPath(path)}
              aria-current={isSelected ? "true" : undefined}
              className={clsx(
                "relative flex items-center gap-2 px-3 h-8 rounded-md text-xs shrink-0 border font-mono overflow-hidden",
                isSelected
                  ? "border-white/15 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300",
              )}
              whileHover={
                isSelected ? {} : { backgroundColor: "rgba(255,255,255,0.05)" }
              }
              transition={SPRING_STANDARD}
            >
              {isSelected && (
                <motion.div
                  layoutId="active-tab-bg"
                  className="absolute inset-0 rounded-md bg-white/8 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.3)]"
                  transition={SPRING_DEFAULT}
                />
              )}
              <span
                className={clsx(
                  "relative z-10 text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0",
                  path.method === "POST"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : path.method === "GET"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : path.method === "PUT"
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        : "bg-gray-500/20 text-gray-400 border border-gray-500/30",
                )}
              >
                {path.method}
              </span>
              <span
                className={clsx(
                  "relative z-10 truncate max-w-45",
                  isSelected ? "text-white" : "",
                )}
                title={path.endpoint}
              >
                {path.endpoint}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 px-3 h-full border-l border-white/10 shrink-0">
        <button
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              }),
            )
          }
          aria-label="Search (⌘K)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/8 bg-transparent hover:bg-white/5 hover:border-white/15 active:bg-white/8 transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-gray-500" />
          <kbd className="text-[11px] font-mono text-gray-400">
            ⌘K
          </kbd>
        </button>
      </div>
    </div>
  );
}
