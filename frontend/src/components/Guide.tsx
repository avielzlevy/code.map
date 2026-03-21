"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, GraduationCap } from "lucide-react";
import { SPRING_SNAPPY } from "@/lib/spring";
import type { UseGuideResult } from "@/hooks/useGuide";

export function Guide({ guide }: { guide: UseGuideResult }) {
  if (!guide.active || !guide.currentStep) return null;

  const { node } = guide.currentStep;
  const fileName = node.fileName.split("/").pop() ?? node.fileName;
  const isFirst = guide.stepIndex === 0;
  const isLast = guide.stepIndex === guide.total - 1;

  return (
    <AnimatePresence>
      <motion.div
        key="guide-pill"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={SPRING_SNAPPY}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/15 bg-zinc-950/95 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.8)]"
      >
        {/* Icon */}
        <GraduationCap className="w-3.5 h-3.5 text-white/30 shrink-0" />

        {/* Node info */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className="text-[12px] font-mono font-semibold text-white truncate max-w-48"
            title={node.funcName}
          >
            {node.funcName}
          </span>
          <span className="text-[10px] font-mono text-gray-500 truncate" title={node.fileName}>
            {fileName}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-white/10 shrink-0" />

        {/* Progress dots */}
        <div className="flex items-center gap-1 shrink-0">
          {Array.from({ length: Math.min(guide.total, 12) }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === guide.stepIndex ? 14 : 4,
                opacity: i === guide.stepIndex ? 1 : 0.2,
              }}
              transition={SPRING_SNAPPY}
              className="h-1 rounded-full bg-white"
            />
          ))}
          {guide.total > 12 && (
            <span className="text-[9px] font-mono text-white/30 ml-1">
              {guide.stepIndex + 1}/{guide.total}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-white/10 shrink-0" />

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={guide.back}
            disabled={isFirst}
            aria-label="Previous node"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <motion.button
            onClick={isLast ? guide.exit : guide.advance}
            aria-label={isLast ? "Finish guide" : "Next node"}
            whileTap={{ scale: 0.95 }}
            transition={SPRING_SNAPPY}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-black font-semibold text-[11px] hover:bg-white/90 transition-colors"
          >
            {isLast ? "Done" : "Next"}
            {!isLast && <ChevronRight className="w-3 h-3" />}
          </motion.button>

          <button
            onClick={guide.exit}
            aria-label="Exit guide"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
