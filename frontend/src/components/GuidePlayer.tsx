"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  GraduationCap,
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  FileCode2,
} from "lucide-react";
import { SPRING_DEFAULT, SPRING_SNAPPY } from "@/lib/spring";
import type { DiffLine, PlayableGuide, PlayableGuideStep } from "@/lib/guide-mock";

const CHANGE_LABEL: Record<string, { label: string; className: string }> = {
  added: { label: "added", className: "text-green-300 border-green-400/40 bg-green-500/10" },
  edited: { label: "edited", className: "text-orange-300 border-orange-400/40 bg-orange-500/10" },
  removed: { label: "removed", className: "text-red-300 border-red-400/40 bg-red-500/10" },
};

// Fixed line box — the bubble anchors off this, so it must match the row height.
const LINE_H = 22;
// Top padding inside the scroll area: leaves room for a bubble above line 0.
const PAD_TOP = 84;
// Staggered fade-in reveal (replaces the old char typewriter — faster).
const REVEAL_STAGGER = 26;
const REVEAL_BASE = 320;
// How long each narration sentence holds focus before auto-advancing.
const DWELL_MIN = 3200;
const DWELL_MAX = 8000;
const dwellFor = (text: string) =>
  Math.min(DWELL_MAX, Math.max(DWELL_MIN, text.length * 55));

type Phase = "reveal" | "narrating";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// GitHub-style diff: a background tint + gutter sign marks the change, while
// the code text keeps its syntax colors (not painted whole-line green/red).
const KIND_BG: Record<DiffLine["kind"], string> = {
  added: "bg-green-500/[0.08]",
  removed: "bg-red-500/[0.08]",
  context: "",
};
const KIND_GUTTER: Record<DiffLine["kind"], string> = {
  added: "text-green-500/70",
  removed: "text-red-500/70",
  context: "text-white/15",
};
const KIND_SIGN: Record<DiffLine["kind"], string> = { added: "+", removed: "−", context: " " };

// Code-syntax palette — derived from GitHub Dark. Centralized here so all the
// token colors live in one place (the rest of the UI uses theme tokens).
const SYNTAX = {
  keyword: "#ff7b72",
  string: "#a5d6ff",
  comment: "#8b949e",
  number: "#79c0ff",
  type: "#ffa657",
  func: "#d2a8ff",
  decorator: "#d2a8ff",
  plain: "#c9d1d9",
} as const;

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "async", "await", "if", "else", "for",
  "while", "do", "switch", "case", "break", "continue", "new", "class", "extends",
  "implements", "interface", "type", "enum", "import", "from", "export", "default",
  "this", "super", "throw", "try", "catch", "finally", "public", "private", "protected",
  "readonly", "static", "void", "null", "undefined", "true", "false", "typeof",
  "instanceof", "in", "of", "as", "yield", "get", "set",
]);

type Token = { value: string; color: string };

// One regex, ordered: comment → string → decorator → number → identifier →
// whitespace → single punctuation char. The last two groups guarantee full
// coverage so there are never gaps.
const TOKEN_RE =
  /(\/\/[^\n]*)|(`[^`]*`|'[^']*'|"[^"]*")|(@[A-Za-z_]\w*)|(\d[\d_]*(?:\.\d+)?)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z0-9_$])/g;

/** Lightweight TS/TSX tokenizer for read-only diff display (not a parser). */
function tokenize(src: string): Token[] {
  const out: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(src))) {
    const full = m[0];
    if (m[1]) out.push({ value: full, color: SYNTAX.comment });
    else if (m[2]) out.push({ value: full, color: SYNTAX.string });
    else if (m[3]) out.push({ value: full, color: SYNTAX.decorator });
    else if (m[4]) out.push({ value: full, color: SYNTAX.number });
    else if (m[5]) {
      let color: string = SYNTAX.plain;
      if (KEYWORDS.has(full)) color = SYNTAX.keyword;
      else if (/^[A-Z]/.test(full)) color = SYNTAX.type;
      else if (src[TOKEN_RE.lastIndex] === "(") color = SYNTAX.func;
      out.push({ value: full, color });
    } else {
      out.push({ value: full, color: SYNTAX.plain });
    }
    if (m.index === TOKEN_RE.lastIndex) TOKEN_RE.lastIndex++; // never loop on zero-width
  }
  return out;
}

function CodePane({
  side,
  lines,
  phase,
  focus,
  bubbleText,
  bubbleKey,
  reduced,
}: {
  side: "before" | "after";
  lines: DiffLine[];
  phase: Phase;
  /** Focused inclusive line range for the active sentence, or null. */
  focus: [number, number] | null;
  /** Narration sentence to float above the change — only on the focused side. */
  bubbleText: string | null;
  bubbleKey: number;
  reduced: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenized = useMemo(() => lines.map((l) => tokenize(l.text)), [lines]);

  // Keep the focused change centered as the narration walks through it.
  useEffect(() => {
    if (!focus || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-line="${focus[0]}"]`);
    el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }, [focus, reduced]);

  return (
    <div className="flex flex-col min-w-0 flex-1">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/8">
        <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/35">{side}</span>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto font-mono text-[12.5px] leading-[22px]">
        <div className="relative" style={{ paddingTop: PAD_TOP, paddingBottom: 96 }}>
          {lines.map((line, i) => {
            const inFocus = focus ? i >= focus[0] && i <= focus[1] : null;
            const dimmed = phase === "narrating" && inFocus === false;
            return (
              <motion.div
                key={i}
                data-line={i}
                initial={reduced ? { opacity: 1 } : { opacity: 0, y: 4 }}
                animate={{ opacity: dimmed ? 0.22 : 1, y: 0 }}
                transition={{
                  ...SPRING_DEFAULT,
                  delay: phase === "reveal" && !reduced ? i * (REVEAL_STAGGER / 1000) : 0,
                }}
                className={`flex items-stretch h-[22px] px-2 ${KIND_BG[line.kind]} ${
                  inFocus ? "shadow-[inset_2px_0_0_0_rgba(255,255,255,0.6)]" : ""
                }`}
              >
                <span className={`select-none w-7 shrink-0 text-right pr-2 text-[10px] leading-[22px] ${KIND_GUTTER[line.kind]}`}>
                  {KIND_SIGN[line.kind]}
                </span>
                <code className="whitespace-pre">
                  {tokenized[i].length === 0
                    ? " "
                    : tokenized[i].map((t, j) => (
                        <span key={j} style={{ color: t.color }}>
                          {t.value}
                        </span>
                      ))}
                </code>
              </motion.div>
            );
          })}

          {/* Narration bubble — floats above the focused change, tail pointing down. */}
          <AnimatePresence>
            {bubbleText && focus && (
              <motion.div
                key={bubbleKey}
                initial={{ opacity: 0, scale: 0.97, y: "-100%" }}
                animate={{ opacity: 1, scale: 1, y: "-100%" }}
                exit={{ opacity: 0, scale: 0.97, y: "-100%" }}
                transition={SPRING_DEFAULT}
                style={{ top: PAD_TOP + focus[0] * LINE_H - 10, left: 28 }}
                className="absolute z-10 w-[min(300px,calc(100%-44px))] origin-bottom-left pointer-events-none"
              >
                <div className="relative rounded-xl border border-white/15 bg-zinc-900/95 backdrop-blur px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.85)]">
                  <p className="text-[12.5px] leading-relaxed text-gray-100 text-left">{bubbleText}</p>
                  <div className="absolute left-5 -bottom-1 w-2.5 h-2.5 rotate-45 bg-zinc-900/95 border-r border-b border-white/15" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

type FileGroup = {
  file: string;
  steps: { index: number; funcName: string; changeType: PlayableGuideStep["changeType"] }[];
};

const DOT: Record<string, string> = {
  added: "bg-green-400",
  edited: "bg-orange-400",
  removed: "bg-red-400",
};

/** Left explorer — the changed files, each expanded into its step functions. */
function FileSidebar({
  groups,
  stepIndex,
  onSelect,
}: {
  groups: FileGroup[];
  stepIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <aside className="w-60 shrink-0 border-r border-white/8 overflow-auto py-3">
      <div className="px-4 pb-2 text-[9px] font-mono uppercase tracking-[0.18em] text-white/30">Files</div>
      {groups.map((g) => {
        const name = g.file.split("/").pop() ?? g.file;
        const dir = g.file.includes("/") ? g.file.slice(0, g.file.lastIndexOf("/")) : "";
        const hasActive = g.steps.some((s) => s.index === stepIndex);
        return (
          <div key={g.file} className="mb-1.5">
            <div className="flex items-center gap-2 px-4 py-1">
              <FileCode2 className={`w-3.5 h-3.5 shrink-0 ${hasActive ? "text-white/70" : "text-white/35"}`} />
              <div className="flex flex-col min-w-0">
                <span className={`text-[12px] font-mono truncate ${hasActive ? "text-white" : "text-gray-300"}`} title={g.file}>
                  {name}
                </span>
                {dir && <span className="text-[9px] font-mono text-white/25 truncate">{dir}</span>}
              </div>
            </div>
            {g.steps.map((st) => {
              const active = st.index === stepIndex;
              return (
                <button
                  key={st.index}
                  onClick={() => onSelect(st.index)}
                  className={`w-full flex items-center gap-2 pl-9 pr-3 py-1 text-left transition-colors ${
                    active
                      ? "bg-white/[0.06] shadow-[inset_2px_0_0_0_rgba(255,255,255,0.55)]"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[st.changeType]}`} />
                  <span className={`text-[12px] font-mono truncate ${active ? "text-white" : "text-gray-400"}`}>
                    {st.funcName}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}

export function GuidePlayer({
  guide,
  onExit,
}: {
  guide: PlayableGuide;
  onExit: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("reveal");
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const step: PlayableGuideStep = guide.steps[stepIndex];
  const before = step.diff.before;
  const after = step.diff.after;

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === guide.steps.length - 1;
  const lastSegment = step.narration.length - 1;

  // Group steps by file for the explorer, preserving step order.
  const fileGroups = useMemo<FileGroup[]>(() => {
    const groups: FileGroup[] = [];
    guide.steps.forEach((s, index) => {
      let g = groups.find((x) => x.file === s.file);
      if (!g) {
        g = { file: s.file, steps: [] };
        groups.push(g);
      }
      g.steps.push({ index, funcName: s.funcName, changeType: s.changeType });
    });
    return groups;
  }, [guide.steps]);

  const goToStep = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(guide.steps.length - 1, i));
      setStepIndex(clamped);
      setSegmentIndex(0);
      setPhase("reveal");
    },
    [guide.steps.length],
  );

  // Reveal → narrate: hold for the staggered fade-in, then start the narration.
  useEffect(() => {
    if (phase !== "reveal") return;
    const count = Math.max(before?.length ?? 0, after?.length ?? 0);
    const ms = reduced ? 0 : count * REVEAL_STAGGER + REVEAL_BASE;
    const id = setTimeout(() => setPhase("narrating"), ms);
    return () => clearTimeout(id);
  }, [phase, before, after, reduced]);

  // Narration auto-advance.
  useEffect(() => {
    if (phase !== "narrating" || !playing) return;
    const text = step.narration[segmentIndex]?.text ?? "";
    const id = setTimeout(() => {
      if (segmentIndex < lastSegment) setSegmentIndex((s) => s + 1);
      else if (!isLastStep) goToStep(stepIndex + 1);
      else setPlaying(false); // reached the end
    }, dwellFor(text));
    return () => clearTimeout(id);
  }, [phase, playing, segmentIndex, lastSegment, isLastStep, stepIndex, step.narration, goToStep]);

  const ensureNarrating = useCallback(() => {
    if (phase === "reveal") setPhase("narrating");
  }, [phase]);

  const nextSentence = useCallback(() => {
    ensureNarrating();
    if (segmentIndex < lastSegment) setSegmentIndex((s) => s + 1);
    else if (!isLastStep) goToStep(stepIndex + 1);
  }, [ensureNarrating, segmentIndex, lastSegment, isLastStep, stepIndex, goToStep]);

  const prevSentence = useCallback(() => {
    ensureNarrating();
    if (segmentIndex > 0) setSegmentIndex((s) => s - 1);
    else if (!isFirstStep) {
      const prev = stepIndex - 1;
      setStepIndex(prev);
      setSegmentIndex(guide.steps[prev].narration.length - 1);
      setPhase("narrating");
    }
  }, [ensureNarrating, segmentIndex, isFirstStep, stepIndex, guide.steps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "ArrowRight") nextSentence();
      else if (e.key === "ArrowLeft") prevSentence();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, nextSentence, prevSentence]);

  const activeFocus = phase === "narrating" ? step.narration[segmentIndex]?.focus ?? null : null;
  const bubbleText = phase === "narrating" ? step.narration[segmentIndex]?.text ?? null : null;
  const focusedSide: "before" | "after" = activeFocus?.side === "before" ? "before" : "after";
  const focusFor = (side: "before" | "after"): [number, number] | null => {
    if (!activeFocus) return null;
    if (activeFocus.side === "both" || activeFocus.side === side) return activeFocus.lines;
    return null;
  };

  const change = CHANGE_LABEL[step.changeType];
  const panes: ("before" | "after")[] = [];
  if (before) panes.push("before");
  if (after) panes.push("after");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SPRING_DEFAULT}
      className="fixed inset-0 z-[100] flex flex-col bg-black"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/8">
        <GraduationCap className="w-4 h-4 text-white/40 shrink-0" />
        <span className="text-[12px] font-semibold text-white truncate">{guide.title}</span>
        <span className="text-[10px] font-mono text-white/30">
          {stepIndex + 1} / {guide.steps.length}
        </span>
        <div className="w-px h-5 bg-white/10" />
        <span className="text-[13px] font-mono font-semibold text-white truncate">{step.funcName}</span>
        <span className="text-[10px] font-mono text-gray-500 truncate">{step.file.split("/").pop()}</span>
        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${change.className}`}>
          {change.label}
        </span>
        <div className="flex-1" />
        <button
          onClick={onExit}
          aria-label="Exit guide"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body — file explorer + stage */}
      <div className="flex flex-1 min-h-0">
        <FileSidebar groups={fileGroups} stepIndex={stepIndex} onSelect={goToStep} />

        {/* Stage — before/after panes. Layers crossfade (absolute) so the new
            step mounts immediately while the old fades out — no layout jump. */}
        <div className="relative flex-1 min-h-0 px-6 py-5">
          <AnimatePresence>
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.99 }}
            transition={SPRING_DEFAULT}
            className="absolute inset-x-6 inset-y-5 flex gap-px rounded-xl border border-white/10 bg-zinc-950 overflow-hidden divide-x divide-white/8"
          >
            {panes.map((side) => (
              <CodePane
                key={side}
                side={side}
                lines={side === "before" ? before! : after!}
                phase={phase}
                focus={focusFor(side)}
                bubbleText={side === focusedSide ? bubbleText : null}
                bubbleKey={segmentIndex}
                reduced={reduced}
              />
            ))}
          </motion.div>
        </AnimatePresence>
        </div>
      </div>

      {/* dwell progress — thin bar signalling each sentence's hold time */}
      <div className="h-0.5 w-full bg-white/5">
        {phase === "narrating" && playing && (
          <motion.div
            key={`${stepIndex}-${segmentIndex}`}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: dwellFor(bubbleText ?? "") / 1000, ease: "linear" }}
            className="h-full bg-white/40"
          />
        )}
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-white/8">
        <button
          onClick={() => goToStep(stepIndex - 1)}
          disabled={isFirstStep}
          aria-label="Previous step"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={prevSentence}
          disabled={isFirstStep && segmentIndex === 0}
          aria-label="Previous sentence"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <motion.button
          onClick={() => setPlaying((p) => !p)}
          whileTap={{ scale: 0.95 }}
          transition={SPRING_SNAPPY}
          aria-label={playing ? "Pause" : "Play"}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-white text-black hover:bg-white/90 transition-colors"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </motion.button>
        <button
          onClick={nextSentence}
          disabled={isLastStep && segmentIndex === lastSegment}
          aria-label="Next sentence"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => goToStep(stepIndex + 1)}
          disabled={isLastStep}
          aria-label="Next step"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-white/10 mx-2" />

        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {guide.steps.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => goToStep(i)}
              animate={{ width: i === stepIndex ? 18 : 6, opacity: i === stepIndex ? 1 : 0.25 }}
              transition={SPRING_SNAPPY}
              className="h-1.5 rounded-full bg-white"
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
