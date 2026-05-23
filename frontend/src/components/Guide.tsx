"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronUp, X, GraduationCap } from "lucide-react";
import clsx from "clsx";
import { SPRING_SNAPPY } from "@/lib/spring";
import type { UseGuideResult } from "@/hooks/useGuide";

/** Renders a --unified=0 diff hunk with conventional +/- coloring. */
function DiffBlock({ diff }: { diff: string }) {
  return (
    <pre className="text-[11px] font-mono leading-relaxed rounded-lg border border-white/8 bg-black/40 overflow-x-auto">
      {diff.split("\n").map((line, i) => {
        const isAdd = line.startsWith("+");
        const isDel = line.startsWith("-");
        return (
          <div
            key={i}
            className={clsx(
              "px-3 whitespace-pre-wrap break-all",
              isAdd && "text-green-400 bg-green-500/5",
              isDel && "text-red-400/80 bg-red-500/5",
              !isAdd && !isDel && "text-gray-500",
            )}
          >
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

export function Guide({ guide }: { guide: UseGuideResult }) {
  const [expanded, setExpanded] = useState(false);

  if (!guide.active || !guide.currentStep) return null;

  const { node } = guide.currentStep;
  const fileName = node.fileName.split("/").pop() ?? node.fileName;
  const isFirst = guide.stepIndex === 0;
  const isLast = guide.stepIndex === guide.total - 1;
  const narration = guide.narration;
  const diff = guide.currentStep.diff ?? null;
  const hasDetail = Boolean(narration || diff);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {/* What-changed panel — progressive disclosure above the pill */}
      <AnimatePresence>
        {expanded && hasDetail && (
          <motion.div
            key="guide-detail"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={SPRING_SNAPPY}
            className="w-[min(90vw,560px)] max-h-[42vh] overflow-y-auto flex flex-col gap-3 p-4 rounded-2xl border border-white/12 bg-zinc-950/97 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.8)]"
          >
            {narration && (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/25">Why</span>
                <p className="text-[12px] leading-relaxed text-gray-300">{narration}</p>
              </div>
            )}
            {diff && (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/25">What changed</span>
                <DiffBlock diff={diff} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pill */}
      <motion.div
        key="guide-pill"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={SPRING_SNAPPY}
        className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/15 bg-zinc-950/95 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.8)]"
      >
        {/* Icon */}
        <GraduationCap className="w-3.5 h-3.5 text-white/30 shrink-0" />

        {/* Node info */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className="text-[12px] font-mono font-semibold text-white truncate max-w-64"
            title={node.funcName}
          >
            {node.funcName}
          </span>
          <span className="text-[10px] font-mono text-gray-500 truncate" title={node.fileName}>
            {fileName}
          </span>
          {narration && (
            <span className="text-[10px] text-gray-400 truncate max-w-64" title={narration}>
              {narration}
            </span>
          )}
        </div>

        {/* What-changed toggle */}
        {hasDetail && (
          <>
            <div className="w-px h-7 bg-white/10 shrink-0" />
            <button
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "Hide what changed" : "Show what changed"}
              aria-expanded={expanded}
              className={clsx(
                "w-7 h-7 flex items-center justify-center rounded-lg border transition-colors",
                expanded
                  ? "border-white/25 bg-white/8 text-white"
                  : "border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5",
              )}
            >
              <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={SPRING_SNAPPY}>
                <ChevronUp className="w-3.5 h-3.5" />
              </motion.span>
            </button>
          </>
        )}

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
    </div>
  );
}
