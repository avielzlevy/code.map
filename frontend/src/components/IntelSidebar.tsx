"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tag, FileText, Sparkles, ExternalLink, Layers } from "lucide-react";
import { FlowNode } from "@/lib/mockData";
import { getVSCodeUrl } from "@/lib/deep-link";

const PANEL_W = 320;
const PANEL_H_EST = 500;
const GAP = 20;

const contentVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, damping: 28, stiffness: 300 } },
};

interface IntelSidebarProps {
  node: FlowNode | null;
  anchorX: number;
  anchorY: number;
  onClose: () => void;
  onDrillDown: (node: FlowNode) => void;
  /** Skip exit animation — used when drilling so the sidebar vanishes instantly
   *  instead of animating out while the drill entrance is already playing. */
  instantClose?: boolean;
}

export function IntelSidebar({ node, anchorX, anchorY, onClose, onDrillDown, instantClose }: IntelSidebarProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!node) return;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    // Prefer right of click; flip left if near right edge
    const fitsRight = anchorX + GAP + PANEL_W + 12 <= winW;
    const rawX = fitsRight ? anchorX + GAP : anchorX - PANEL_W - GAP;
    const x = Math.max(12, Math.min(rawX, winW - PANEL_W - 12));
    const y = Math.max(60, Math.min(anchorY - 100, winH - PANEL_H_EST - 12));
    setPos({ x, y });
  }, [node, anchorX, anchorY]);

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          style={{ position: "fixed", left: pos.x, top: pos.y, width: PANEL_W, zIndex: 50 }}
          initial={{ opacity: 0, scale: 0.93, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={instantClose ? { opacity: 0 } : { opacity: 0, scale: 0.93, y: 8 }}
          transition={instantClose ? { duration: 0 } : { type: "spring", damping: 28, stiffness: 260 }}
          className="rounded-xl bg-black/90 backdrop-blur-md border border-white/12 shadow-[0_8px_40px_rgba(0,0,0,0.9)] flex flex-col text-gray-200 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-4 py-3 border-b border-white/10">
            <div className="flex flex-col min-w-0 flex-1 mr-3">
              <span className="font-mono text-sm font-bold text-white truncate">{node.funcName}()</span>
              <span className="text-[11px] text-gray-500 font-mono break-all mt-0.5 leading-snug">
                {node.fileName}:{node.line}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1 hover:bg-white/10 active:bg-white/15 rounded-md transition-colors text-gray-500 hover:text-white shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <motion.div
            key={node.id}
            className="overflow-y-auto p-4 space-y-5 max-h-[55vh]"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            {node.intentTag && (
              <motion.div variants={itemVariants}>
                <h3 className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2 flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Intent
                </h3>
                <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-md text-amber-400 font-mono text-sm">
                  {node.intentTag}
                </div>
              </motion.div>
            )}

            {node.docstring && (
              <motion.div variants={itemVariants}>
                <h3 className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Docs
                </h3>
                <pre className="bg-white/5 p-3 rounded-md border border-white/10 text-xs text-gray-300 font-mono whitespace-pre-wrap">
                  {node.docstring}
                </pre>
              </motion.div>
            )}

            <AnimatePresence>
              {node.aiSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", damping: 28, stiffness: 220 }}
                  className="overflow-hidden"
                >
                  <h3 className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-white/40" /> AI Summary
                  </h3>
                  <div className="bg-white/3 p-4 rounded-md border border-white/8">
                    <p className="text-sm text-gray-300 leading-relaxed">{node.aiSummary}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer actions */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2">
            {node.hasDetail && (
              <motion.button
                onClick={() => { onDrillDown(node); onClose(); }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", damping: 22, stiffness: 320 }}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-white/90 text-black py-2.5 px-4 rounded-md font-semibold transition-colors"
              >
                <Layers className="w-4 h-4" />
                Drill into calls
              </motion.button>
            )}
            <motion.a
              href={getVSCodeUrl(node.fileName, node.line)}
              rel="noopener"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 border border-white/15 hover:border-white/40 text-gray-400 hover:text-white py-2.5 px-4 rounded-md font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in VS Code
            </motion.a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
