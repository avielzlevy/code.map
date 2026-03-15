"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Tag, FileText, Sparkles, ExternalLink, Layers } from "lucide-react";
import { FlowNode } from "@/lib/mockData";
import { getVSCodeUrl } from "@/lib/deep-link";

interface IntelSidebarProps {
  node: FlowNode | null;
  onClose: () => void;
  onDrillDown: (node: FlowNode) => void;
}

export function IntelSidebar({ node, onClose, onDrillDown }: IntelSidebarProps) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 384 }}
          exit={{ width: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 220 }}
          className="h-full shrink-0 overflow-hidden"
        >
        <div className="w-96 h-full bg-black/60 backdrop-blur-2xl border-l border-white/10 shadow-[-10px_0_30px_rgba(0,0,0,0.8)] flex flex-col z-50 text-gray-200">
          {/* Header — funcName is the title */}
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

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Intent (Conditional) */}
            {node.intentTag && (
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-2 flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Intent
                </h3>
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-md text-emerald-400 font-mono text-sm">
                  {node.intentTag}
                </div>
              </div>
            )}

            {/* Docs (Conditional) */}
            {node.docstring && (
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-2 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Docs
                </h3>
                <pre className="bg-white/5 p-3 rounded-md border border-white/10 text-xs text-gray-300 font-mono whitespace-pre-wrap">
                  {node.docstring}
                </pre>
              </div>
            )}

            {/* AI Summary (Conditional) */}
            <AnimatePresence>
              {node.aiSummary && (
                <motion.div
                  initial={{ opacity: 0, y: -12, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", damping: 28, stiffness: 220 }}
                  className="overflow-hidden"
                >
                  <h3 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-500" /> AI Summary
                  </h3>
                  <div className="bg-emerald-500/5 p-4 rounded-md border border-emerald-500/15">
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {node.aiSummary}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Footer — drill-down is primary, VS Code is secondary */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2">
            {node.hasDetail && (
              <button
                onClick={() => { onDrillDown(node); onClose(); }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 active:scale-[0.98] text-black py-2.5 px-4 rounded-md font-semibold transition-all"
              >
                <Layers className="w-4 h-4" />
                Drill into calls
              </button>
            )}
            <a
              href={getVSCodeUrl(node.fileName, node.line)}
              className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 active:bg-white/10 border border-white/15 hover:border-white/25 text-gray-400 hover:text-white py-2.5 px-4 rounded-md font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in VS Code
            </a>
          </div>
        </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
