"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Code2, Tag, FileText, BrainCircuit, ExternalLink, Layers } from "lucide-react";
import { FlowNode } from "@/lib/mockData";
import { getVSCodeUrl } from "@/lib/deep-link";
import { useState, useEffect } from "react";

interface IntelSidebarProps {
  node: FlowNode | null;
  onClose: () => void;
  onDrillDown: (node: FlowNode) => void;
}

export function IntelSidebar({ node, onClose, onDrillDown }: IntelSidebarProps) {
  const [loadingAI, setLoadingAI] = useState(false);

  // Simulate loading new AI summary on node change
  useEffect(() => {
    if (node) {
      setLoadingAI(true);
      const timer = setTimeout(() => {
        setLoadingAI(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [node?.id]);

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute top-0 right-0 w-96 h-full bg-black/60 backdrop-blur-2xl border-l border-white/10 shadow-[-10px_0_30px_rgba(0,0,0,0.8)] flex flex-col z-50 text-gray-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
              <Code2 className="w-5 h-5 text-white" />
              Intel Report
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Structural Layer */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
                Structural Layer
              </h3>
              <div className="bg-white/5 p-3 rounded-md border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                <div className="font-mono text-sm text-white font-bold mb-1">
                  {node.funcName}()
                </div>
                <div className="text-xs text-gray-400 font-mono break-all">
                  {node.fileName}:{node.line}
                </div>
              </div>
            </div>

            {/* Intent Layer (Conditional) */}
            {node.intentTag && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Intent Layer
                </h3>
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-md text-emerald-400 font-mono text-sm shadow-[inset_0_1px_4px_rgba(16,185,129,0.1)]">
                  {node.intentTag}
                </div>
              </div>
            )}

            {/* Developer Layer (Code Docs) */}
            {node.docstring && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Developer Layer
                </h3>
                <pre className="bg-white/5 p-3 rounded-md border border-white/10 text-xs text-gray-300 font-mono whitespace-pre-wrap shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                  {node.docstring}
                </pre>
              </div>
            )}

            {/* Narrative Layer (AI) */}
            <AnimatePresence>
              {node.aiSummary && (
                <motion.div
                  initial={{ opacity: 0, y: -20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-2 mt-2">
                    <BrainCircuit className="w-4 h-4 text-purple-400" /> Narrative Layer
                  </h3>
                  <div className="bg-purple-900/10 p-4 rounded-md border border-purple-500/20 shadow-[inset_0_0_20px_rgba(168,85,247,0.05),0_4px_20px_rgba(0,0,0,0.2)]">
                    {loadingAI ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-3 bg-white/10 rounded-full w-3/4"></div>
                        <div className="h-3 bg-white/10 rounded-full w-full"></div>
                        <div className="h-3 bg-white/10 rounded-full w-5/6"></div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {node.aiSummary}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2">
            {node.hasDetail && (
              <button
                onClick={() => { onDrillDown(node); onClose(); }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 hover:border-emerald-500/70 text-emerald-400 py-2.5 px-4 rounded-md font-medium transition-colors shadow-[0_0_10px_rgba(16,185,129,0.1)]"
              >
                <Layers className="w-4 h-4" />
                Dive Deeper
              </button>
            )}
            <a
              href={getVSCodeUrl(node.fileName, node.line)}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-200 text-black py-2.5 px-4 rounded-md font-medium transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              <ExternalLink className="w-4 h-4" />
              View Code in VS Code
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
