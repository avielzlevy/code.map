"use client";

import { useState, useCallback, useRef } from "react";
import { ExecutionPath, GuideArtifact } from "@/lib/flow-types";
import {
  buildGuideSequence,
  buildSequenceFromArtifact,
  FlowGuideStep,
} from "@/lib/guide-steps";
import { DrillEntry } from "@/app/app/page";

export interface UseGuideResult {
  active: boolean;
  currentStep: FlowGuideStep | null;
  stepIndex: number;
  total: number;
  /** The drillStack the canvas should show for the current step. */
  drillStack: DrillEntry[];
  /** Node id to ring-highlight in the canvas. */
  guideNodeId: string | null;
  /** Commit narration for the current step (change-driven guides only). */
  narration: string | null;
  start: (path: ExecutionPath) => void;
  /** Start a change-driven guide from a diff artifact, latching onto loaded paths. */
  startGuide: (artifact: GuideArtifact, paths: ExecutionPath[], repoRoot: string) => void;
  advance: () => void;
  back: () => void;
  exit: () => void;
}

type GuideState = {
  sequence: FlowGuideStep[];
  stepIndex: number | null;
};

const EMPTY: GuideState = { sequence: [], stepIndex: null };

export function useGuide(): UseGuideResult {
  const [state, setState] = useState<GuideState>(EMPTY);
  // Keep a stable ref so advance/back never capture stale sequence length
  const sequenceLenRef = useRef(0);
  sequenceLenRef.current = state.sequence.length;

  const start = useCallback((path: ExecutionPath) => {
    const seq = buildGuideSequence(path);
    setState({ sequence: seq, stepIndex: seq.length > 0 ? 0 : null });
  }, []);

  const startGuide = useCallback(
    (artifact: GuideArtifact, paths: ExecutionPath[], repoRoot: string) => {
      const seq = buildSequenceFromArtifact(paths, artifact, repoRoot);
      setState({ sequence: seq, stepIndex: seq.length > 0 ? 0 : null });
    },
    [],
  );

  const advance = useCallback(() => {
    setState((prev) => {
      if (prev.stepIndex === null) return prev;
      const next = prev.stepIndex + 1;
      if (next >= prev.sequence.length) return EMPTY; // end — exit guide
      return { ...prev, stepIndex: next };
    });
  }, []);

  const back = useCallback(() => {
    setState((prev) => {
      if (prev.stepIndex === null || prev.stepIndex === 0) return prev;
      return { ...prev, stepIndex: prev.stepIndex - 1 };
    });
  }, []);

  const exit = useCallback(() => {
    setState(EMPTY);
  }, []);

  const { sequence, stepIndex } = state;
  const active = stepIndex !== null && sequence.length > 0;
  const currentStep = active ? sequence[stepIndex!] : null;

  return {
    active,
    currentStep,
    stepIndex: stepIndex ?? 0,
    total: sequence.length,
    drillStack: currentStep?.drillStack ?? [],
    guideNodeId: currentStep?.node.id ?? null,
    narration: currentStep?.narration ?? null,
    start,
    startGuide,
    advance,
    back,
    exit,
  };
}
