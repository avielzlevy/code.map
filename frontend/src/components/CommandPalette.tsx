"use client";

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Command, Network, FunctionSquare } from "lucide-react";
import { ExecutionPath, FlowNode } from "@/lib/flow-types";
import clsx from "clsx";
import { SPRING_STANDARD, SPRING_SNAPPY, SPRING_DEFAULT } from "@/lib/spring";

interface CommandPaletteProps {
  paths: ExecutionPath[];
  onSelectEndpoint: (path: ExecutionPath) => void;
  onSelectNode: (
    path: ExecutionPath,
    node: FlowNode,
    parentId: string | null,
  ) => void;
}

type SearchResultItem =
  | { type: "endpoint"; path: ExecutionPath; label: string; sublabel: string }
  | {
      type: "node";
      path: ExecutionPath;
      node: FlowNode;
      parentId: string | null;
      label: string;
      sublabel: string;
    };

export function CommandPalette({
  paths,
  onSelectEndpoint,
  onSelectNode,
}: CommandPaletteProps) {
  "use no memo"; // React Compiler over-memoizes this component — query state changes must trigger re-renders
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
      // autoFocus is unreliable inside AnimatePresence — focus explicitly after paint
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const allItems = useMemo(() => {
    const items: SearchResultItem[] = [];
    const seenEndpoints = new Set<string>();
    const seenNodes = new Set<string>();

    paths.forEach((path) => {
      const endpointKey = `${path.method}::${path.endpoint}`;
      if (!seenEndpoints.has(endpointKey)) {
        seenEndpoints.add(endpointKey);
        items.push({
          type: "endpoint",
          path,
          label: path.endpoint,
          sublabel: path.method,
        });
      }

      // Root nodes
      path.nodes.forEach((node) => {
        const key = `${path.endpoint}::${node.id}`;
        if (seenNodes.has(key)) return;
        seenNodes.add(key);
        items.push({
          type: "node",
          path,
          node,
          parentId: null,
          label: node.funcName,
          sublabel: `${path.endpoint} · ${node.fileName.split("/").pop()}`,
        });
      });

      // Child nodes
      Object.entries(path.nodeDetails || {}).forEach(([parentId, detail]) => {
        detail.nodes.forEach((node) => {
          const key = `${path.endpoint}::${node.id}`;
          if (seenNodes.has(key)) return;
          seenNodes.add(key);
          items.push({
            type: "node",
            path,
            node,
            parentId,
            label: node.funcName,
            sublabel: `${path.endpoint} · ${node.fileName.split("/").pop()}`,
          });
        });
      });
    });

    return items;
  }, [paths]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim();

    if (!q) return allItems.filter((item) => item.type === "endpoint");

    const fuzzyMatch = (text: string, pattern: string): boolean => {
      let pi = 0;
      for (let i = 0; i < text.length && pi < pattern.length; i++) {
        if (text[i] === pattern[pi]) pi++;
      }
      return pi === pattern.length;
    };

    const rankItem = (item: SearchResultItem): number => {
      const label = item.label.toLowerCase();
      const sublabel = item.sublabel.toLowerCase();
      if (label === q) return 0;             // exact
      if (label.startsWith(q)) return 1;     // prefix
      if (label.includes(q)) return 2;       // substring
      if (fuzzyMatch(label, q)) return 3;    // fuzzy label
      if (sublabel.includes(q)) return 4;    // sublabel substring
      if (fuzzyMatch(sublabel, q)) return 5; // fuzzy sublabel
      return 99;
    };

    return allItems
      .filter((item) => rankItem(item) < 99)
      .sort((a, b) => rankItem(a) - rankItem(b))
      .slice(0, 20);
  }, [query, allItems]);

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
      if (filteredItems.length === 0) return;
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredItems.length === 0) return;
      setSelectedIndex(
        (prev) => (prev - 1 + filteredItems.length) % filteredItems.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING_DEFAULT}
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={SPRING_STANDARD}
            className="relative w-full max-w-2xl bg-black/98 border border-white/15 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
          >
            {/* Search Input */}
            <div className="flex items-center px-4 py-4 border-b border-white/10 group">
              <Search className="w-5 h-5 text-gray-400 group-focus-within:text-white transition-colors" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Jump to endpoint or function..."
                aria-label="Jump to endpoint or function"
                className="flex-1 appearance-none bg-transparent border-0 ring-0 outline-none focus:ring-0 focus-visible:outline-none text-white px-3 text-lg placeholder:text-gray-500"
              />
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-400 text-xs font-mono">
                <Command className="w-3 h-3" />
                <span>K</span>
              </div>
            </div>

            {/* Results List */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  No matches — try a function name or endpoint path.
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const active = index === selectedIndex;
                  const itemKey =
                    item.type === "endpoint"
                      ? `endpoint-${item.path.method}-${item.path.endpoint}`
                      : `node-${item.path.endpoint}-${item.parentId ?? "root"}-${item.node.id}`;
                  const prevItem = index > 0 ? filteredItems[index - 1] : null;
                  const showGroupLabel =
                    !prevItem || prevItem.type !== item.type;
                  return (
                    <Fragment key={itemKey}>
                      {showGroupLabel && (
                        <div className="px-3 pt-2 pb-1 text-[11px] text-gray-600 font-medium select-none">
                          {item.type === "endpoint" ? "Endpoints" : "Functions"}
                        </div>
                      )}
                      <button
                        onClick={() => handleSelect(index)}
                        className={clsx(
                          "relative w-full flex items-center justify-between px-3 py-3 rounded-lg text-left overflow-hidden",
                          !active && "hover:bg-white/5",
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId="active-palette-result"
                            className="absolute inset-0 rounded-lg bg-white/8 shadow-[inset_2px_0_0_0_rgba(255,255,255,0.3)]"
                            transition={SPRING_SNAPPY}
                          />
                        )}
                        <div className="relative z-10 flex items-center gap-3 min-w-0">
                          <div
                            className={clsx(
                              "p-1.5 rounded-md border shrink-0",
                              item.type === "endpoint"
                                ? "bg-white/8 border-white/15 text-white/70"
                                : "bg-white/5 border-white/10 text-gray-400",
                            )}
                          >
                            {item.type === "endpoint" ? (
                              <Network className="w-4 h-4" />
                            ) : (
                              <FunctionSquare className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span
                              className={clsx(
                                "font-medium truncate",
                                active ? "text-white" : "text-gray-300",
                              )}
                              title={item.label}
                            >
                              {item.label}
                            </span>
                            <span className="text-xs text-gray-500 truncate" title={item.sublabel}>
                              {item.sublabel}
                            </span>
                          </div>
                        </div>
                        {active && (
                          <div className="relative z-10 flex items-center gap-1 text-gray-400 text-xs">
                            ↵
                          </div>
                        )}
                      </button>
                    </Fragment>
                  );
                })
              )}
            </div>
            {/* Footer */}
            <div className="px-4 py-2 bg-white/5 border-t border-white/10 text-[11px] text-gray-500 flex items-center gap-4 font-mono">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-gray-500">
                  ↑↓
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-gray-500">
                  ↵
                </kbd>
                select
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-gray-500">
                  Esc
                </kbd>
                close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
