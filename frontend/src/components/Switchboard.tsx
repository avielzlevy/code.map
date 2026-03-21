"use client";

import {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, GraduationCap } from "lucide-react";
import { ExecutionPath } from "@/lib/flow-types";
import clsx from "clsx";
import Image from "next/image";
import { SPRING_SNAPPY } from "@/lib/spring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SwitchboardProps {
  paths: ExecutionPath[];
  selectedPath: ExecutionPath | null;
  onSelectPath: (path: ExecutionPath) => void;
  onStartGuide?: (path: ExecutionPath) => void;
}

type MenuType = "resources" | "methods";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull the primary resource name out of an endpoint string.
 *  `/api/orders/:id` → `orders`   `/users` → `users`   `/` → `root` */
function extractResource(endpoint: string): string {
  const parts = endpoint.split("/").filter(Boolean);
  const skip = parts[0]?.toLowerCase() === "api" ? 1 : 0;
  const seg = parts[skip];
  return seg && !seg.startsWith(":") ? seg : "root";
}

function groupPaths(
  paths: ExecutionPath[],
  by: "resource" | "method",
): Record<string, ExecutionPath[]> {
  const groups: Record<string, ExecutionPath[]> = {};
  for (const p of paths) {
    const key = by === "resource" ? extractResource(p.endpoint) : p.method;
    (groups[key] ??= []).push(p);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const METHOD_CLS: Record<string, string> = {
  GET: "text-blue-400 bg-blue-500/15 border-blue-500/25",
  POST: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
  PUT: "text-yellow-400 bg-yellow-500/15 border-yellow-500/25",
  DELETE: "text-red-400 bg-red-500/15 border-red-500/25",
  PATCH: "text-orange-400 bg-orange-500/15 border-orange-500/25",
};

function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_CLS[method] ?? "text-gray-400 bg-gray-500/15 border-gray-500/25";
  return (
    <span
      className={clsx(
        "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0",
        cls,
      )}
    >
      {method}
    </span>
  );
}

/** The two-level cascading card — rendered below the nav label that triggered it. */
function CascadeMenu({
  menuType,
  groups,
  selectedPath,
  onSelect,
  onStartGuide,
  onMouseEnter,
  onMouseLeave,
}: {
  menuType: MenuType;
  groups: Record<string, ExecutionPath[]>;
  selectedPath: ExecutionPath | null;
  onSelect: (path: ExecutionPath) => void;
  onStartGuide?: (path: ExecutionPath) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const groupKeys = Object.keys(groups).sort();
  const subPaths = hoveredKey ? (groups[hoveredKey] ?? []) : [];

  // Reset hover when menu type changes (e.g., switching from resources to methods)
  useEffect(() => {
    setHoveredKey(null);
  }, [menuType]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={SPRING_SNAPPY}
      className="flex items-start gap-1"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Card 1 — group list (resources or methods) */}
      <div className="bg-zinc-950/98 border border-white/12 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden min-w-[152px]">
        <div className="px-3 py-2 border-b border-white/6">
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-[0.18em]">
            {menuType}
          </span>
        </div>
        <div className="py-1">
          {groupKeys.map((key) => {
            const count = groups[key].length;
            const isHovered = hoveredKey === key;
            return (
              <button
                key={key}
                onMouseEnter={() => setHoveredKey(key)}
                className={clsx(
                  "w-full flex items-center justify-between gap-3 px-3 h-9 text-left transition-colors",
                  isHovered
                    ? "bg-white/8 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5",
                )}
              >
                {menuType === "methods" ? (
                  <MethodBadge method={key} />
                ) : (
                  <span className="text-[12px] font-mono truncate">{key}</span>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-white/20">{count}</span>
                  <ChevronRight
                    className={clsx(
                      "w-3 h-3 transition-colors",
                      isHovered ? "text-white/50" : "text-white/15",
                    )}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Card 2 — animates in/out as a whole; content swaps in-place (no key) */}
      <AnimatePresence>
        {hoveredKey && subPaths.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="bg-zinc-950/98 border border-white/12 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden min-w-[260px]"
          >
            <div className="px-3 py-2 border-b border-white/6">
              <span className="text-[9px] font-mono text-white/25 uppercase tracking-[0.18em]">
                {hoveredKey}
              </span>
            </div>
            <div className="py-1">
              {subPaths.map((path) => {
                const isSelected =
                  selectedPath?.endpoint === path.endpoint &&
                  selectedPath?.method === path.method;
                return (
                  <div
                    key={`${path.method}:${path.endpoint}`}
                    className={clsx(
                      "group flex items-center transition-colors",
                      isSelected ? "bg-white/8" : "hover:bg-white/5",
                    )}
                  >
                    {/* Main select area */}
                    <button
                      onClick={() => onSelect(path)}
                      className={clsx(
                        "flex-1 flex items-center gap-2.5 pl-3 pr-2 h-9 text-left min-w-0",
                        isSelected ? "text-white" : "text-gray-400 hover:text-white",
                      )}
                    >
                      <MethodBadge method={path.method} />
                      <span
                        className={clsx(
                          "text-[12px] font-mono truncate",
                          isSelected && "text-white",
                        )}
                        title={path.endpoint}
                      >
                        {path.endpoint}
                      </span>
                    </button>
                    {/* Guide hat — hidden until row is hovered */}
                    {onStartGuide && (
                      <button
                        onClick={() => onStartGuide(path)}
                        title="Walk through this flow"
                        aria-label="Start flow guide"
                        className="shrink-0 w-8 h-9 flex items-center justify-center text-transparent group-hover:text-white/30 hover:!text-white/70 transition-colors"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Switchboard({ paths, selectedPath, onSelectPath, onStartGuide }: SwitchboardProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const resourcesBtnRef = useRef<HTMLButtonElement>(null);
  const methodsBtnRef = useRef<HTMLButtonElement>(null);

  const [openMenu, setOpenMenu] = useState<MenuType | null>(null);
  const [cardLeft, setCardLeft] = useState(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byResource = useMemo(() => groupPaths(paths, "resource"), [paths]);
  const byMethod = useMemo(() => groupPaths(paths, "method"), [paths]);
  const groups = openMenu === "resources" ? byResource : byMethod;

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setOpenMenu(null);
    }, 60);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const openMenuFor = useCallback(
    (menu: MenuType, btnRef: React.RefObject<HTMLButtonElement | null>) => {
      cancelClose();
      if (barRef.current && btnRef.current) {
        const barRect = barRef.current.getBoundingClientRect();
        const btnRect = btnRef.current.getBoundingClientRect();
        setCardLeft(btnRect.left - barRect.left);
      }
      setOpenMenu(menu);
    },
    [cancelClose],
  );

  const handleSelect = useCallback(
    (path: ExecutionPath) => {
      onSelectPath(path);
      setOpenMenu(null);
    },
    [onSelectPath],
  );

  return (
    <div
      ref={barRef}
      className="relative w-full h-12 border-b border-white/10 bg-black flex items-center shrink-0 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
    >
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

      {/* Nav labels */}
      <div data-guide="nav-labels" className="flex items-center h-full px-3 gap-0.5 shrink-0">
        {(
          [
            { menu: "resources" as MenuType, ref: resourcesBtnRef },
            { menu: "methods" as MenuType, ref: methodsBtnRef },
          ] as const
        ).map(({ menu, ref }) => {
          const isOpen = openMenu === menu;
          return (
            <button
              key={menu}
              ref={ref}
              onMouseEnter={() => openMenuFor(menu, ref)}
              onMouseLeave={scheduleClose}
              className={clsx(
                "h-8 px-3 rounded-md text-[12px] font-mono capitalize transition-colors select-none",
                isOpen
                  ? "bg-white/8 text-white border border-white/12"
                  : "text-gray-500 hover:text-gray-200 hover:bg-white/5 border border-transparent",
              )}
            >
              {menu}
            </button>
          );
        })}
      </div>

      {/* Selected path indicator — fills remaining space */}
      <div className="flex-1 flex items-center gap-2 px-3 min-w-0 overflow-hidden">
        {selectedPath && (
          <>
            <div className="w-px h-4 bg-white/10 shrink-0" />
            <MethodBadge method={selectedPath.method} />
            <span
              className="text-[12px] font-mono text-gray-500 truncate"
              title={selectedPath.endpoint}
            >
              {selectedPath.endpoint}
            </span>
          </>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 px-3 h-full border-l border-white/10 shrink-0">
        <button
          data-guide="search-button"
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
            )
          }
          aria-label="Search (⌘K)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/8 bg-transparent hover:bg-white/5 hover:border-white/15 active:bg-white/8 transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-gray-500" />
          <kbd className="text-[11px] font-mono text-gray-400">⌘K</kbd>
        </button>
      </div>

      {/* Cascading hover menu — absolutely positioned below the bar */}
      <AnimatePresence>
        {openMenu && (
          <div
            className="absolute top-full pt-2 z-50"
            style={{ left: cardLeft }}
          >
            <CascadeMenu
              menuType={openMenu}
              groups={groups}
              selectedPath={selectedPath}
              onSelect={handleSelect}
              onStartGuide={onStartGuide ? (path) => { onStartGuide(path); setOpenMenu(null); } : undefined}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
