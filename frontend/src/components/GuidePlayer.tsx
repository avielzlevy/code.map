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
  LayoutGrid,
  Info,
  Volume2,
  VolumeX,
  AudioLines,
  ChevronDown,
  Check,
  Scale,
} from "lucide-react";
import { SPRING_DEFAULT, SPRING_SNAPPY } from "@/lib/spring";
import type {
  DiffLine,
  GuideDecisions,
  PlayableGuide,
  PlayableGuideStep,
} from "@/lib/guide-playable";

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

// Names that signal a higher-quality voice, in rough order of niceness.
const PREFERRED_VOICES = ["Google US English", "Samantha", "Ava", "Allison", "Zoe", "Evan", "Aria", "Jenny"];

/** Heuristic ranking — higher is more natural. The default browser voice is robotic. */
function voiceScore(v: SpeechSynthesisVoice): number {
  const n = v.name;
  if (/premium|enhanced/i.test(n)) return 100; // Apple high-quality variants
  if (/neural|natural/i.test(n)) return 95;
  const idx = PREFERRED_VOICES.findIndex((p) => n.includes(p));
  if (idx >= 0) return 90 - idx;
  if (/google/i.test(n)) return 70; // Chrome's network voices — much better than default
  if (v.localService === false) return 60;
  return 10;
}

/** English voices, best-first. Reacts to async voice loading (`voiceschanged`). */
function useEnglishVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const en = window.speechSynthesis
        .getVoices()
        .filter((v) => v.lang.toLowerCase().startsWith("en"));
      en.sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
      setVoices(en);
    };
    const id = setTimeout(load, 0); // initial (voices are often empty on first sync call)
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      clearTimeout(id);
      window.speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);
  return voices;
}

const VOICE_STORAGE_KEY = "codemap-guide-voice";
const RATE_STORAGE_KEY = "codemap-guide-rate";
const RATE_STEPS = [1, 1.5, 2] as const;

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

          {/* Narration bubble — floats above the focused change, tail pointing
              down. Only rendered when there's a line to point at; focus-less
              sentences show in the stage's top context strip instead. */}
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
  activeIndex,
  hasOverview,
  hasDecisions,
  hasClosing,
  onSelect,
  onSelectOverview,
  onSelectDecisions,
  onSelectClosing,
}: {
  groups: FileGroup[];
  /** Active step's array index; -1 = overview, -2 = recap, -3 = decisions. */
  activeIndex: number;
  hasOverview: boolean;
  hasDecisions: boolean;
  hasClosing: boolean;
  onSelect: (i: number) => void;
  onSelectOverview: () => void;
  onSelectDecisions: () => void;
  onSelectClosing: () => void;
}) {
  return (
    <aside className="w-60 shrink-0 border-r border-white/8 overflow-auto py-3">
      {hasOverview && (
        <button
          onClick={onSelectOverview}
          className={`w-full flex items-center gap-2 px-4 py-1.5 mb-2 text-left transition-colors ${
            activeIndex === -1
              ? "bg-white/[0.06] shadow-[inset_2px_0_0_0_rgba(255,255,255,0.55)]"
              : "hover:bg-white/[0.03]"
          }`}
        >
          <LayoutGrid className={`w-3.5 h-3.5 shrink-0 ${activeIndex === -1 ? "text-white/70" : "text-white/35"}`} />
          <span className={`text-[12px] font-medium ${activeIndex === -1 ? "text-white" : "text-gray-300"}`}>
            Overview
          </span>
        </button>
      )}
      <div className="px-4 pb-2 text-[9px] font-mono uppercase tracking-[0.18em] text-white/30">Files</div>
      {groups.map((g) => {
        const name = g.file.split("/").pop() ?? g.file;
        const dir = g.file.includes("/") ? g.file.slice(0, g.file.lastIndexOf("/")) : "";
        const hasActive = g.steps.some((s) => s.index === activeIndex);
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
              const active = st.index === activeIndex;
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
      {hasDecisions && (
        <button
          onClick={onSelectDecisions}
          className={`w-full flex items-center gap-2 px-4 py-1.5 mt-2 text-left transition-colors ${
            activeIndex === -3
              ? "bg-amber-400/[0.08] shadow-[inset_2px_0_0_0_rgba(245,158,11,0.6)]"
              : "hover:bg-white/[0.03]"
          }`}
        >
          <Scale className={`w-3.5 h-3.5 shrink-0 ${activeIndex === -3 ? "text-amber-400/90" : "text-amber-400/40"}`} />
          <span className={`text-[12px] font-medium ${activeIndex === -3 ? "text-white" : "text-gray-300"}`}>
            Decisions
          </span>
        </button>
      )}
      {hasClosing && (
        <button
          onClick={onSelectClosing}
          className={`w-full flex items-center gap-2 px-4 py-1.5 mt-2 text-left transition-colors ${
            activeIndex === -2
              ? "bg-white/[0.06] shadow-[inset_2px_0_0_0_rgba(255,255,255,0.55)]"
              : "hover:bg-white/[0.03]"
          }`}
        >
          <GraduationCap className={`w-3.5 h-3.5 shrink-0 ${activeIndex === -2 ? "text-white/70" : "text-white/35"}`} />
          <span className={`text-[12px] font-medium ${activeIndex === -2 ? "text-white" : "text-gray-300"}`}>
            Recap
          </span>
        </button>
      )}
    </aside>
  );
}

/** One labeled briefing section; the active sentence (by global index) is emphasized. */
function OverviewBlock({
  label,
  lines,
  offset,
  activeSegment,
}: {
  label: string;
  lines: string[];
  offset: number;
  activeSegment: number;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/30">{label}</span>
      {lines.map((text, i) => {
        const active = offset + i === activeSegment;
        return (
          <p
            key={i}
            className={`pl-4 border-l-2 text-[15px] leading-relaxed transition-all duration-500 ${
              active ? "border-white/55 text-gray-100" : "border-white/10 text-gray-500 opacity-60"
            }`}
          >
            {text}
          </p>
        );
      })}
    </div>
  );
}

/** The guide's first screen — a narrated "before vs what changed" briefing. */
function OverviewScreen({
  guide,
  activeSegment,
}: {
  guide: PlayableGuide;
  /** Index across [before…, change…]; the active sentence is emphasized. */
  activeSegment: number;
}) {
  const before = guide.overview?.before ?? [];
  const change = guide.overview?.change ?? [];

  const fileCount = new Set(guide.steps.map((s) => s.file)).size;
  const fnCount = guide.steps.length;
  const counts: Record<string, number> = {};
  guide.steps.forEach((s) => (counts[s.changeType] = (counts[s.changeType] ?? 0) + 1));
  const statBits = (["added", "edited", "removed"] as const)
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${k}`);

  return (
    <div className="absolute inset-0 overflow-auto rounded-xl border border-white/10 bg-zinc-950 px-10 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-9">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-white">{guide.title}</h1>
          {guide.summary && (
            <p className="text-[14px] leading-relaxed text-white/60 max-w-xl">{guide.summary}</p>
          )}
          <p className="text-[12px] font-mono text-white/40">
            {fileCount} file{fileCount !== 1 ? "s" : ""} · {fnCount} function{fnCount !== 1 ? "s" : ""}
            {statBits.length > 0 ? ` · ${statBits.join(" · ")}` : ""}
          </p>
        </div>
        <OverviewBlock label="Before" lines={before} offset={0} activeSegment={activeSegment} />
        <OverviewBlock label="What changed" lines={change} offset={before.length} activeSegment={activeSegment} />
      </div>
    </div>
  );
}

/**
 * The decisions page — the rejected options and tradeoffs behind the change.
 * Enriched/optional content, so it carries the amber accent; the chosen option
 * uses white emphasis + a green check, rejected ones are dimmed and struck.
 */
function DecisionsScreen({ decisions }: { decisions: GuideDecisions }) {
  return (
    <div className="absolute inset-0 overflow-auto rounded-xl border border-amber-400/20 bg-zinc-950 px-10 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Scale className="w-3.5 h-3.5 text-amber-400/80" />
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-amber-400/60">
              Decisions
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Why this approach</h1>
          <p className="text-[13px] leading-relaxed text-white/45">
            The options weighed — and the tradeoffs behind the one that shipped.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {decisions.entries.map((e, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                e.chosen
                  ? "border-amber-400/30 bg-amber-400/[0.04]"
                  : "border-white/8 bg-white/[0.01]"
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {e.chosen ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <X className="w-4 h-4 text-white/30" />
                )}
              </span>
              <div className="flex flex-col gap-1 min-w-0">
                <span
                  className={`text-[14px] font-medium ${
                    e.chosen
                      ? "text-white"
                      : "text-white/40 line-through decoration-white/20"
                  }`}
                >
                  {e.option}
                </span>
                <p className={`text-[13px] leading-relaxed ${e.chosen ? "text-gray-300" : "text-gray-500"}`}>
                  {e.rationale}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The guide's final screen — a short narrated recap that wraps the walkthrough up. */
function ClosingScreen({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 overflow-auto rounded-xl border border-white/10 bg-zinc-950 px-10 py-10 flex items-center justify-center">
      <div className="max-w-xl flex flex-col items-center gap-4 text-center">
        <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/30">Recap</span>
        <p className="text-[18px] leading-relaxed text-gray-100">{text}</p>
      </div>
    </div>
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

  // Screens = optional overview (screen 0) + one per step. The overview narrates
  // its briefing immediately (no code to reveal); steps reveal then narrate.
  const hasOverview =
    !!guide.overview && (guide.overview.before.length > 0 || guide.overview.change.length > 0);
  const hasDecisions =
    !!guide.decisions &&
    guide.decisions.entries.length > 0 &&
    guide.decisions.narration.trim().length > 0;
  const hasClosing = !!guide.closing && guide.closing.trim().length > 0;
  const overviewOffset = hasOverview ? 1 : 0;
  const decisionsOffset = hasDecisions ? 1 : 0;
  const closingOffset = hasClosing ? 1 : 0;
  const totalScreens = guide.steps.length + overviewOffset + decisionsOffset + closingOffset;
  // The decisions page sits right after the last step (before any closing recap).
  const decisionsScreenIndex = overviewOffset + guide.steps.length;

  const [screenIndex, setScreenIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(hasOverview ? "narrating" : "reveal");
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  // True when the browser blocked autoplay on load (no user gesture yet).
  const [audioBlocked, setAudioBlocked] = useState(false);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  // The mp4 renderer opens the guide with ?record=1 — it forces autoplay and
  // composes audio separately, so it must never pause on a blocked clip.
  const recordMode =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("record") === "1";

  // Playback speed (applies to audio, speech, and the dwell timer).
  const [rate, setRate] = useState<number>(() => {
    try {
      return typeof window !== "undefined" ? Number(localStorage.getItem(RATE_STORAGE_KEY)) || 1 : 1;
    } catch {
      return 1;
    }
  });
  const cycleRate = useCallback(() => {
    setRate((r) => {
      const next = RATE_STEPS[(RATE_STEPS.indexOf(r as (typeof RATE_STEPS)[number]) + 1) % RATE_STEPS.length];
      try {
        localStorage.setItem(RATE_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const voices = useEnglishVoices();
  const [voiceURI, setVoiceURI] = useState<string | null>(() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem(VOICE_STORAGE_KEY) : null;
    } catch {
      return null;
    }
  });
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  // Chosen voice, or the top-ranked one as the default.
  const selectedVoice = useMemo(() => {
    if (voices.length === 0) return null;
    return (voiceURI && voices.find((v) => v.voiceURI === voiceURI)) || voices[0];
  }, [voices, voiceURI]);

  const previewVoice = useCallback((v: SpeechSynthesisVoice) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance("This is how the narration will sound.");
    u.voice = v;
    u.lang = v.lang;
    synth.speak(u);
  }, []);

  const selectVoice = useCallback(
    (v: SpeechSynthesisVoice) => {
      setVoiceURI(v.voiceURI);
      try {
        localStorage.setItem(VOICE_STORAGE_KEY, v.voiceURI);
      } catch {
        /* ignore */
      }
      previewVoice(v);
    },
    [previewVoice],
  );

  const onOverview = hasOverview && screenIndex === 0;
  const onDecisions = hasDecisions && screenIndex === decisionsScreenIndex;
  const onClosing = hasClosing && screenIndex === totalScreens - 1;
  const stepArrayIndex = screenIndex - overviewOffset;
  const step: PlayableGuideStep | null =
    onOverview || onDecisions || onClosing ? null : guide.steps[stepArrayIndex];
  const before = step?.diff.before ?? null;
  const after = step?.diff.after ?? null;

  const overviewSegments = useMemo<{ text: string }[]>(() => {
    if (!guide.overview) return [];
    return [...guide.overview.before, ...guide.overview.change].map((text) => ({ text }));
  }, [guide.overview]);
  const decisionsSegments = useMemo<{ text: string }[]>(
    () => (guide.decisions ? [{ text: guide.decisions.narration }] : []),
    [guide.decisions],
  );
  const closingSegments = useMemo<{ text: string }[]>(
    () => (guide.closing ? [{ text: guide.closing }] : []),
    [guide.closing],
  );

  // The narration driving the active screen (overview briefing, step, decisions, or recap).
  const narration = onOverview
    ? overviewSegments
    : onDecisions
      ? decisionsSegments
      : onClosing
        ? closingSegments
        : step?.narration ?? [];
  const lastSegment = narration.length - 1;
  const activeText = narration[segmentIndex]?.text ?? "";

  const isFirstScreen = screenIndex === 0;
  const isLastScreen = screenIndex === totalScreens - 1;

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

  const goToScreen = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(totalScreens - 1, i));
      setScreenIndex(clamped);
      setSegmentIndex(0);
      // Prose screens (overview, decisions, recap) narrate straight away; code steps reveal first.
      const isBrief =
        (hasOverview && clamped === 0) ||
        (hasDecisions && clamped === decisionsScreenIndex) ||
        (hasClosing && clamped === totalScreens - 1);
      setPhase(isBrief ? "narrating" : "reveal");
    },
    [totalScreens, hasOverview, hasDecisions, decisionsScreenIndex, hasClosing],
  );

  // Number of narration sentences on a given screen — for landing on the last one.
  const segmentsOnScreen = useCallback(
    (i: number): number => {
      if (hasOverview && i === 0) return overviewSegments.length;
      if (hasDecisions && i === decisionsScreenIndex) return decisionsSegments.length;
      if (hasClosing && i === totalScreens - 1) return closingSegments.length;
      return guide.steps[i - overviewOffset]?.narration.length ?? 0;
    },
    [hasOverview, hasDecisions, decisionsScreenIndex, hasClosing, totalScreens, overviewSegments.length, decisionsSegments.length, closingSegments.length, guide.steps, overviewOffset],
  );

  // Reveal → narrate: hold for the staggered fade-in, then start the narration.
  useEffect(() => {
    if (phase !== "reveal") return;
    const count = Math.max(before?.length ?? 0, after?.length ?? 0);
    const ms = reduced ? 0 : count * REVEAL_STAGGER + REVEAL_BASE;
    const id = setTimeout(() => setPhase("narrating"), ms);
    return () => clearTimeout(id);
  }, [phase, before, after, reduced]);

  // Advance to the next sentence / screen, or stop at the very end.
  const advance = useCallback(() => {
    if (segmentIndex < lastSegment) setSegmentIndex((s) => s + 1);
    else if (!isLastScreen) goToScreen(screenIndex + 1);
    else setPlaying(false);
  }, [segmentIndex, lastSegment, isLastScreen, screenIndex, goToScreen]);

  // Narration playback: speak the active sentence (Web Speech) and advance when
  // it finishes. Falls back to a timed dwell when muted/unsupported, with a
  // safety guard so speech that never fires onend can't stall the walkthrough.
  useEffect(() => {
    if (phase !== "narrating" || !playing) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      advance();
    };

    // 1) Pre-rendered HD clip (preferred) — instant, no generation latency.
    const clipUrl = !muted && activeText.length > 0 ? guide.audio?.clips[activeText] : undefined;
    if (clipUrl) {
      const audio = new Audio(clipUrl);
      audio.playbackRate = rate;
      audio.onended = finish;
      audio.onerror = finish; // missing clip shouldn't stall the walkthrough
      // If the browser blocks autoplay (no gesture yet), pause and prompt instead
      // of silently advancing — so the very first sentence is heard too.
      audio.play().then(() => setAudioBlocked(false)).catch(() => {
        if (recordMode) return; // renderer: let the guard advance, never pause
        setAudioBlocked(true);
        setPlaying(false);
      });
      const guard = setTimeout(finish, (activeText.length * 95) / rate + 8000);
      return () => {
        clearTimeout(guard);
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      };
    }

    // 2) Web Speech (local fallback voice).
    const canSpeak = speechSupported && !muted && activeText.length > 0;
    if (canSpeak) {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(activeText);
      if (selectedVoice) utter.voice = selectedVoice;
      utter.lang = selectedVoice?.lang ?? "en-US";
      utter.rate = rate;
      utter.onend = finish;
      utter.onerror = finish;
      synth.speak(utter);
      // Guard: if onend never fires (autoplay policy, lost utterance), move on.
      const guard = setTimeout(finish, (activeText.length * 95) / rate + 6000);
      return () => {
        clearTimeout(guard);
        utter.onend = null;
        utter.onerror = null;
        synth.cancel();
      };
    }

    const id = setTimeout(finish, dwellFor(activeText) / rate);
    return () => clearTimeout(id);
  }, [phase, playing, muted, rate, activeText, screenIndex, segmentIndex, speechSupported, selectedVoice, advance, guide.audio, recordMode]);

  const ensureNarrating = useCallback(() => {
    if (phase === "reveal") setPhase("narrating");
  }, [phase]);

  const nextSentence = useCallback(() => {
    ensureNarrating();
    if (segmentIndex < lastSegment) setSegmentIndex((s) => s + 1);
    else if (!isLastScreen) goToScreen(screenIndex + 1);
  }, [ensureNarrating, segmentIndex, lastSegment, isLastScreen, screenIndex, goToScreen]);

  const prevSentence = useCallback(() => {
    ensureNarrating();
    if (segmentIndex > 0) setSegmentIndex((s) => s - 1);
    else if (!isFirstScreen) {
      const prev = screenIndex - 1;
      setScreenIndex(prev);
      setSegmentIndex(Math.max(0, segmentsOnScreen(prev) - 1));
      setPhase("narrating");
    }
  }, [ensureNarrating, segmentIndex, isFirstScreen, screenIndex, segmentsOnScreen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (voiceMenuOpen) setVoiceMenuOpen(false);
        else onExit();
      } else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "ArrowRight") nextSentence();
      else if (e.key === "ArrowLeft") prevSentence();
      else if (e.key === "m" || e.key === "M") setMuted((x) => !x);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, nextSentence, prevSentence, voiceMenuOpen]);

  const narrating = !onOverview && !onClosing && phase === "narrating" && !!step;
  const activeFocus = narrating ? step!.narration[segmentIndex]?.focus ?? null : null;
  const bubbleText = narrating ? step!.narration[segmentIndex]?.text ?? null : null;
  // Which pane shows the narration bubble — the focused side if it exists, else
  // whichever pane is present (so a no-focus sentence still gets a bubble).
  const preferredSide: "before" | "after" = activeFocus?.side === "before" ? "before" : "after";
  const bubbleSide: "before" | "after" =
    preferredSide === "after" ? (after ? "after" : "before") : before ? "before" : "after";
  const focusFor = (side: "before" | "after"): [number, number] | null => {
    if (!activeFocus) return null;
    if (activeFocus.side === "both" || activeFocus.side === side) return activeFocus.lines;
    return null;
  };

  // A focus-less sentence about off-screen context — shown as a top strip, not
  // pinned to a line.
  const contextNote = narrating && !activeFocus ? bubbleText : null;
  // Reserve the strip's slot for the WHOLE step when it has any context sentence,
  // so the diff never shifts as the strip fades in/out between sentences.
  const activeStepHasContext = !onOverview && !!step && step.narration.some((n) => !n.focus);

  const change = step ? CHANGE_LABEL[step.changeType] : null;
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
          {screenIndex + 1} / {totalScreens}
        </span>
        <div className="w-px h-5 bg-white/10" />
        {onOverview ? (
          <span className="text-[13px] font-mono font-semibold text-white/70 truncate">Overview</span>
        ) : onDecisions ? (
          <span className="text-[13px] font-mono font-semibold text-amber-300/80 truncate">Decisions</span>
        ) : onClosing ? (
          <span className="text-[13px] font-mono font-semibold text-white/70 truncate">Recap</span>
        ) : !step ? (
          <span className="text-[13px] font-mono font-semibold text-white/70 truncate">Overview</span>
        ) : (
          <>
            <span className="text-[13px] font-mono font-semibold text-white truncate">{step.funcName}</span>
            <span className="text-[10px] font-mono text-gray-500 truncate">{step.file.split("/").pop()}</span>
            {change && (
              <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${change.className}`}>
                {change.label}
              </span>
            )}
          </>
        )}
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
        <FileSidebar
          groups={fileGroups}
          activeIndex={onOverview ? -1 : onDecisions ? -3 : onClosing ? -2 : stepArrayIndex}
          hasOverview={hasOverview}
          hasDecisions={hasDecisions}
          hasClosing={hasClosing}
          onSelect={(i) => goToScreen(i + overviewOffset)}
          onSelectOverview={() => goToScreen(0)}
          onSelectDecisions={() => goToScreen(decisionsScreenIndex)}
          onSelectClosing={() => goToScreen(totalScreens - 1)}
        />

        {/* Stage — a column: optional top context strip + the screen area.
            The strip is in normal flow so it never overlaps the code; screen
            layers crossfade (absolute) so the new mounts as the old fades out. */}
        <div className="flex flex-col flex-1 min-h-0 px-6 py-5 gap-3">
          {/* Context slot — fixed height reserved for the whole step (when it has
              context), so the diff stays put while the card fades in/out. */}
          {activeStepHasContext && (
            <div className="shrink-0 h-[60px]">
              <AnimatePresence>
                {contextNote && (
                  <motion.div
                    key="context-card"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={SPRING_DEFAULT}
                    className="h-full flex items-start gap-2.5 rounded-xl border border-white/12 bg-zinc-900/90 backdrop-blur px-4 py-2.5 overflow-hidden"
                  >
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/40" />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-white/30">Context</span>
                      <p className="text-[13px] leading-snug text-gray-100 line-clamp-2">{contextNote}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="relative flex-1 min-h-0">
            <AnimatePresence>
              {onOverview ? (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 14, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -14, scale: 0.99 }}
                  transition={SPRING_DEFAULT}
                  className="absolute inset-0"
                >
                  <OverviewScreen guide={guide} activeSegment={segmentIndex} />
                </motion.div>
              ) : onDecisions && guide.decisions ? (
                <motion.div
                  key="decisions"
                  initial={{ opacity: 0, y: 14, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -14, scale: 0.99 }}
                  transition={SPRING_DEFAULT}
                  className="absolute inset-0"
                >
                  <DecisionsScreen decisions={guide.decisions} />
                </motion.div>
              ) : onClosing ? (
                <motion.div
                  key="closing"
                  initial={{ opacity: 0, y: 14, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -14, scale: 0.99 }}
                  transition={SPRING_DEFAULT}
                  className="absolute inset-0"
                >
                  <ClosingScreen text={guide.closing ?? ""} />
                </motion.div>
              ) : (
                <motion.div
                  key={screenIndex}
                  initial={{ opacity: 0, y: 14, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -14, scale: 0.99 }}
                  transition={SPRING_DEFAULT}
                  className="absolute inset-0 flex gap-px rounded-xl border border-white/10 bg-zinc-950 overflow-hidden divide-x divide-white/8"
                >
                  {panes.map((side) => (
                    <CodePane
                      key={side}
                      side={side}
                      lines={side === "before" ? before! : after!}
                      phase={phase}
                      focus={focusFor(side)}
                      bubbleText={side === bubbleSide && activeFocus ? bubbleText : null}
                      bubbleKey={segmentIndex}
                      reduced={reduced}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* dwell progress — thin bar signalling each sentence's hold time */}
      <div className="h-0.5 w-full bg-white/5">
        {phase === "narrating" && playing && (
          <motion.div
            key={`${screenIndex}-${segmentIndex}`}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: dwellFor(activeText) / rate / 1000, ease: "linear" }}
            className="h-full bg-white/40"
          />
        )}
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-white/8">
        <button
          onClick={() => goToScreen(screenIndex - 1)}
          disabled={isFirstScreen}
          aria-label="Previous step"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={prevSentence}
          disabled={isFirstScreen && segmentIndex === 0}
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
          disabled={isLastScreen && segmentIndex === lastSegment}
          aria-label="Next sentence"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => goToScreen(screenIndex + 1)}
          disabled={isLastScreen}
          aria-label="Next step"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-white/10 mx-2" />

        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute narration" : "Mute narration"}
          title={
            speechSupported
              ? muted
                ? "Unmute narration"
                : "Mute narration"
              : "Narration isn't supported in this browser"
          }
          className={`w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 hover:text-white hover:border-white/25 hover:bg-white/5 transition-colors ${
            muted ? "text-white/30" : "text-gray-400"
          }`}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          onClick={cycleRate}
          aria-label={`Playback speed ${rate}x`}
          title="Playback speed"
          className="h-9 min-w-[2.75rem] px-2 flex items-center justify-center rounded-lg border border-white/10 text-[11px] font-mono text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5 transition-colors"
        >
          {rate}x
        </button>

        {/* Voice picker (Web Speech fallback only) — hidden when HD audio is pre-rendered */}
        {!guide.audio && (
        <div className="relative">
          <button
            onClick={() => {
              setVoiceMenuOpen((o) => {
                if (!o) setPlaying(false);
                return !o;
              });
            }}
            disabled={!speechSupported || voices.length === 0}
            aria-label="Choose narration voice"
            title={selectedVoice ? `Voice: ${selectedVoice.name}` : "Choose narration voice"}
            className="h-9 px-2.5 flex items-center gap-1 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <AudioLines className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>

          <AnimatePresence>
            {voiceMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setVoiceMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={SPRING_SNAPPY}
                  className="absolute bottom-full right-0 mb-2 z-50 w-64 max-h-72 overflow-auto rounded-xl border border-white/12 bg-zinc-900/95 backdrop-blur p-1 shadow-[0_8px_32px_rgba(0,0,0,0.8)]"
                >
                  <div className="px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-[0.16em] text-white/30">
                    Narration voice
                  </div>
                  {voices.map((v) => {
                    const active = v.voiceURI === selectedVoice?.voiceURI;
                    return (
                      <button
                        key={v.voiceURI}
                        onClick={() => selectVoice(v)}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          active ? "bg-white/[0.08] text-white" : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        <span className="truncate text-[12px]">{v.name}</span>
                        {active && <Check className="w-3.5 h-3.5 shrink-0 text-white/70" />}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        )}

        <div className="w-px h-6 bg-white/10 mx-2" />

        {/* Screen dots — overview (if any) + one per step */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalScreens }).map((_, i) => (
            <motion.button
              key={i}
              onClick={() => goToScreen(i)}
              animate={{ width: i === screenIndex ? 18 : 6, opacity: i === screenIndex ? 1 : 0.25 }}
              transition={SPRING_SNAPPY}
              className="h-1.5 rounded-full bg-white"
              aria-label={`Go to screen ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Autoplay gate — browsers block sound without a gesture, so the first
          sentence would be silent. One click starts it (and unblocks the rest). */}
      <AnimatePresence>
        {audioBlocked && !playing && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING_DEFAULT}
            onClick={() => setPlaying(true)}
            className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm"
          >
            <span className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
              <Play className="w-7 h-7 ml-1" />
            </span>
            <span className="text-[13px] text-white/80">Play the walkthrough — with narration</span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
