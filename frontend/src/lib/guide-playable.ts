/**
 * The shape the GuidePlayer consumes, plus the adapter from a saved (backend)
 * GuideArtifact. Line indices in `focus.lines` are 0-based and inclusive,
 * addressing the `before`/`after` line arrays on the same step's diff.
 */
import type { GuideArtifact } from "./flow-types";

export type DiffSide = "before" | "after" | "both";

/** One spoken sentence and the change area it should focus while "speaking". */
export type NarrationSegment = {
  text: string;
  focus?: { side: DiffSide; lines: [number, number] };
};

/** A unified line in a diff pane — drives added/removed coloring. */
export type DiffLine = {
  text: string;
  kind: "added" | "removed" | "context";
};

export type StepDiff = {
  language: string;
  /** Null when the function is brand new (changeType "added"). */
  before: DiffLine[] | null;
  /** Null when the function was deleted (changeType "removed"). */
  after: DiffLine[] | null;
};

export type PlayableGuideStep = {
  nodeId: string;
  funcName: string;
  file: string;
  changeType: "added" | "edited" | "removed";
  diff: StepDiff;
  narration: NarrationSegment[];
};

export type GuideOverview = { before: string[]; change: string[] };

/** Pre-rendered narration audio: sentence text → clip URL. */
export type GuideAudio = { voice: string; model: string; clips: Record<string, string> };

export type PlayableGuide = {
  title: string;
  slug: string;
  /** One-line TL;DR shown on the overview screen. */
  summary?: string;
  /** Closing recap sentence(s) shown as the final screen. */
  closing?: string;
  /** Optional big-picture briefing shown as the first screen. */
  overview?: GuideOverview;
  /** Pre-rendered narration audio (HD voice); absent → Web Speech fallback. */
  audio?: GuideAudio;
  steps: PlayableGuideStep[];
};

/** True when a saved artifact carries the v2 narration/diff payload the player needs. */
export function isPlayableArtifact(artifact: GuideArtifact): boolean {
  return artifact.steps.some((s) => (s.narration && s.narration.length > 0) || !!s.diff);
}

/** Adapt a saved GuideArtifact into the player's shape. */
export function artifactToPlayable(artifact: GuideArtifact, slug: string): PlayableGuide {
  return {
    title: artifact.meta?.title ?? slug,
    slug,
    summary: artifact.summary,
    closing: artifact.closing,
    overview: artifact.overview,
    audio: artifact.audio,
    steps: artifact.steps.map(
      (s): PlayableGuideStep => ({
        nodeId: s.nodeId,
        funcName: s.methodName,
        file: s.file,
        changeType: s.changeType,
        diff: s.diff ?? { language: "text", before: null, after: null },
        narration:
          s.narration && s.narration.length > 0
            ? s.narration
            : [{ text: s.explanation ?? "" }],
      }),
    ),
  };
}
