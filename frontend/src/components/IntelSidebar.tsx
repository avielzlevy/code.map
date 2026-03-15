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
          className="absolute top-0 right-0 w-96 h-full bg-[#1e222a]/95 backdrop-blur-md border-l border-[#333a45] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] flex flex-col z-50 text-[#e2e8f0]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#333a45]">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Code2 className="w-5 h-5 text-[#3b82f6]" />
              Intel Report
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#333a45] rounded-md transition-colors text-gray-400 hover:text-white"
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
              <div className="bg-[#0f1115] p-3 rounded-md border border-[#333a45]">
                <div className="font-mono text-sm text-[#3b82f6] font-bold mb-1">
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
                <div className="bg-[#10b981]/10 border border-[#10b981]/30 p-2.5 rounded-md text-[#10b981] font-mono text-sm">
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
                <pre className="bg-[#0f1115] p-3 rounded-md border border-[#333a45] text-xs text-gray-300 font-mono whitespace-pre-wrap">
                  {node.docstring}
                </pre>
              </div>
            )}

            {/* Narrative Layer (AI) */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-purple-400" /> Narrative Layer
              </h3>
              <div className="bg-[#0f1115] p-4 rounded-md border border-purple-900/50 shadow-[inset_0_0_20px_rgba(168,85,247,0.05)]">
                {loadingAI ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-[#333a45] rounded rounded-full w-3/4"></div>
                    <div className="h-3 bg-[#333a45] rounded rounded-full w-full"></div>
                    <div className="h-3 bg-[#333a45] rounded rounded-full w-5/6"></div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {node.aiSummary || "No AI summary available for this node."}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-[#333a45] bg-[#0f1115] flex flex-col gap-2">
            {node.hasDetail && (
              <button
                onClick={() => { onDrillDown(node); onClose(); }}
                className="w-full flex items-center justify-center gap-2 bg-[#10b981]/15 hover:bg-[#10b981]/25 border border-[#10b981]/40 hover:border-[#10b981]/70 text-[#10b981] py-2.5 px-4 rounded-md font-medium transition-colors"
              >
                <Layers className="w-4 h-4" />
                Dive Deeper
              </button>
            )}
            <a
              href={getVSCodeUrl(node.fileName, node.line)}
              className="w-full flex items-center justify-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white py-2.5 px-4 rounded-md font-medium transition-colors"
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
