"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SPRING_SNAPPY } from "@/lib/spring";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  /** Which side the tooltip appears on. Defaults to "top". */
  side?: "top" | "bottom";
  /**
   * Classes applied to the outermost wrapper.
   * Use this for positioning the trigger (e.g. "absolute top-3 right-3").
   * The inner anchor layer is always `relative` — no conflicts.
   */
  className?: string;
}

/**
 * Custom tooltip styled to match the code-map UI.
 * Spring-animated, monospace font, pure-black background.
 *
 * Two-layer structure:
 *   outer div  — applies `className` (safe for absolute/fixed positioning)
 *   inner div  — always `relative inline-flex`, anchors the popup
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    delayRef.current = setTimeout(() => setVisible(true), 120);
  };

  const hide = () => {
    if (delayRef.current) clearTimeout(delayRef.current);
    setVisible(false);
  };

  const popup = (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="tooltip"
          initial={{ opacity: 0, scale: 0.88, y: side === "top" ? 5 : -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={SPRING_SNAPPY}
          className={`
            pointer-events-none absolute z-[999] left-1/2 -translate-x-1/2
            whitespace-nowrap px-2 py-1 rounded-md
            bg-zinc-950 border border-white/10
            text-[11px] font-mono text-white/65
            shadow-[0_6px_24px_rgba(0,0,0,0.95)]
            ${side === "top" ? "bottom-full mb-2" : "top-full mt-2"}
          `}
        >
          {content}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              ...(side === "top"
                ? { top: "100%", borderTop: "4px solid #111113", borderLeft: "4px solid transparent", borderRight: "4px solid transparent" }
                : { bottom: "100%", borderBottom: "4px solid #111113", borderLeft: "4px solid transparent", borderRight: "4px solid transparent" }),
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  const inner = (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {popup}
    </div>
  );

  if (className) {
    return <div className={className}>{inner}</div>;
  }

  return inner;
}
