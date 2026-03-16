"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Command, Network, FunctionSquare } from "lucide-react";
import { ExecutionPath, FlowNode } from "@/lib/mockData";
import clsx from "clsx";

interface CommandPaletteProps {
  paths: ExecutionPath[];
  onSelectEndpoint: (path: ExecutionPath) => void;
  onSelectNode: (path: ExecutionPath, node: FlowNode, parentId: string | null) => void;
}

type SearchResultItem =
  | { type: "endpoint"; path: ExecutionPath; label: string; sublabel: string }
  | { type: "node"; path: ExecutionPath; node: FlowNode; parentId: string | null; label: string; sublabel: string };

export function CommandPalette({ paths, onSelectEndpoint, onSelectNode }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const allItems = useMemo(() => {
    const items: SearchResultItem[] = [];

    paths.forEach((path) => {
      items.push({
        type: "endpoint",
        path,
        label: path.endpoint,
        sublabel: `${path.method} endpoint`,
      });

      // Root nodes
      path.nodes.forEach((node) => {
        items.push({
          type: "node",
          path,
          node,
          parentId: null,
          label: node.funcName,
          sublabel: `in ${path.endpoint} • ${node.fileName.split("/").pop()}`,
        });
      });

      // Child nodes
      Object.entries(path.nodeDetails || {}).forEach(([parentId, detail]) => {
        detail.nodes.forEach((node) => {
          items.push({
            type: "node",
            path,
            node,
            parentId,
            label: node.funcName,
            sublabel: `in ${path.endpoint} • ${node.fileName.split("/").pop()}`,
          });
        });
      });
    });

    return items;
  }, [paths]);

  const filteredItems = useMemo(() => {
    if (!query) return allItems.slice(0, 10);
    const q = query.toLowerCase();
    return allItems.filter((item) => item.label.toLowerCase().includes(q) || item.sublabel.toLowerCase().includes(q));
  }, [query, allItems]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (index: number) => {
    const item = filteredItems[index];
    if (!item) return;

    if (item.type === "endpoint") {
      onSelectEndpoint(item.path);
    } else {
      onSelectNode(item.path, item.node, item.parentId);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(255,255,255,0.05)] overflow-hidden flex flex-col"
          >
            {/* Search Input */}
            <div className="flex items-center px-4 py-4 border-b border-white/10 group">
              <Search className="w-5 h-5 text-gray-400 group-focus-within:text-white transition-colors" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search endpoints and functions..."
                aria-label="Search endpoints and functions"
                className="flex-1 bg-transparent border-none outline-none text-white px-3 text-lg placeholder:text-gray-500"
              />
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-400 text-xs font-mono">
                <Command className="w-3 h-3" />
                <span>K</span>
              </div>
            </div>

            {/* Results List */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">No results found.</div>
              ) : (
                filteredItems.map((item, index) => {
                  const active = index === selectedIndex;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSelect(index)}
                      className={clsx(
                        "relative w-full flex items-center justify-between px-3 py-3 rounded-lg text-left overflow-hidden",
                        !active && "hover:bg-white/5"
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="active-palette-result"
                          className="absolute inset-0 rounded-lg bg-white/8 shadow-[inset_2px_0_0_0_rgba(255,255,255,0.3)]"
                          transition={{ type: "spring", damping: 30, stiffness: 320 }}
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-3">
                        <div
                          className={clsx(
                            "p-1.5 rounded-md border",
                            item.type === "endpoint"
                              ? "bg-white/8 border-white/15 text-white/70"
                              : "bg-white/5 border-white/10 text-gray-400"
                          )}
                        >
                          {item.type === "endpoint" ? <Network className="w-4 h-4" /> : <FunctionSquare className="w-4 h-4" />}
                        </div>
                        <div className="flex flex-col">
                          <span className={clsx("font-medium", active ? "text-white" : "text-gray-300")}>
                            {item.label}
                          </span>
                          <span className="text-xs text-gray-500">{item.sublabel}</span>
                        </div>
                      </div>
                      {active && (
                        <div className="relative z-10 flex items-center gap-1 text-gray-400 text-xs">
                          ↵
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {/* Footer */}
            <div className="px-4 py-2 bg-white/5 border-t border-white/10 text-xs text-gray-500 flex items-center gap-4">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>esc close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
