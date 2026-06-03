import { RemoteAIProvider, AIProvider } from '../constants';

type CodeMapBaseConfig = {
  /** Port for the sidecar visualization server. Defaults to 4567. */
  port?: number;
  /** File system path for the AI summary cache directory. Defaults to .flow-cache in cwd. */
  cachePath?: string;
  /** Root directory to scan for source files. Defaults to process.cwd(). */
  sourceRoot?: string;
};

export type CodeMapConfig = CodeMapBaseConfig &
  (
    | { enableAI: true; provider: 'ollama'; ollamaHost?: string; model?: string }
    | { enableAI: true; provider: RemoteAIProvider; apiKey: string; model?: string }
    | { enableAI?: false }
  );

export interface ResolvedCodeMapConfig {
  port: number;
  enableAI: boolean;
  apiKey: string | undefined;
  provider: AIProvider | '';
  model: string | undefined;
  cachePath: string;
  sourceRoot: string;
  ollamaHost: string | undefined;
}

export interface FlowNode {
  id: string;
  label: string;
  methodName: string;
  type: 'controller' | 'worker-entry' | 'scheduler' | 'queue-handler' | 'service' | 'utility' | 'unknown';
  filePath: string;
  lineNumber: number;
  docstring?: string;
  rawBody: string;
  aiSummary?: string;
  customTag?: string;
  httpMethod?: string;
  routePath?: string;
  controllerPrefix?: string;
}

/** Frontend-ready types — matches the shape expected by the React visualiser. */
export interface FrontendNode {
  id: string;
  type: 'standard' | 'enhanced';
  funcName: string;
  fileName: string;
  line: number;
  intentTag?: string;
  docstring?: string;
  aiSummary?: string;
  /** True when this node has an expanded detail graph available. */
  hasDetail: boolean;
  /** Sequential position within a step chain (1-based), shown as a badge. */
  stepNumber?: number;
}

export interface FrontendEdge {
  id: string;
  source: string;
  target: string;
  callOrder: number;
  /** 'call' = parent invokes child; 'step' = sequential next call in same function body */
  edgeType: 'call' | 'step';
}

export interface NodeDetail {
  nodes: FrontendNode[];
  edges: FrontendEdge[];
}

export interface FrontendExecutionPath {
  endpoint: string;
  method: string;
  /** Root layer: controller → service → @FlowStep nodes only. */
  nodes: FrontendNode[];
  edges: FrontendEdge[];
  /** Full internal call graph for each drillable node, keyed by node id. */
  nodeDetails: Record<string, NodeDetail>;
}

export interface FlowEdge {
  from: string;
  to: string;
  callOrder: number;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  generatedAt: string;
}

// ── Guide artifact ──────────────────────────────────────────────────────────
// A portable, LLM-authored walkthrough of a change, mapped onto the live graph.
// Authored by the codemap-guide skill from the conversation (not a git diff).
// All ids and file paths are repo-relative so the file is shareable across
// machines and consumable by an LLM with no tool access.

export type GuideChangeType = 'added' | 'edited' | 'removed';

/** A single line in a before/after diff pane. */
export type GuideDiffKind = 'added' | 'removed' | 'context';
export interface GuideDiffLine {
  text: string;
  kind: GuideDiffKind;
}

/** Snapshotted before/after for a step's function, captured from git at author time. */
export interface GuideDiff {
  language: string;
  /** Null when the function is brand new (changeType "added"). */
  before: GuideDiffLine[] | null;
  /** Null when the function was deleted (changeType "removed"). */
  after: GuideDiffLine[] | null;
}

/** Which pane a narration sentence focuses, and the inclusive line range within it. */
export interface GuideFocus {
  side: 'before' | 'after' | 'both';
  lines: [number, number];
}

/** One spoken sentence and the change area it should focus while playing. */
export interface GuideNarrationSegment {
  text: string;
  focus?: GuideFocus;
}

export interface GuideStep {
  /** Repo-relative node id, matches a node in the live graph after normalization. */
  nodeId: string;
  methodName: string;
  /** Repo-relative file path. */
  file: string;
  type: FlowNode['type'];
  /** What happened to this node in the change being explained. */
  changeType: GuideChangeType;
  /** The narrated walkthrough for this step — sentences with optional focus. */
  narration: GuideNarrationSegment[];
  /** Before/after code, snapshotted from git. */
  diff: GuideDiff;
  /** @deprecated Legacy single-note for old consumers; mirrors narration[0].text. */
  explanation: string;
}

export interface GuideSubgraphNode {
  id: string;
  label: string;
  methodName: string;
  type: FlowNode['type'];
  file: string;
  line: number;
  role: 'changed' | 'context';
}

/** Orientation briefing shown as the guide's first screen (the "big picture"). */
export interface GuideOverview {
  /** How the affected area worked before the change — the missing context. */
  before: string[];
  /** What the change does and why. */
  change: string[];
}

/** One option weighed while making the change — chosen or rejected, and why. */
export interface GuideDecision {
  /** The option that was considered (e.g. "a DB lock"). */
  option: string;
  /** True for the option that was adopted; false for a rejected alternative. */
  chosen: boolean;
  /** Why it was chosen or rejected. */
  rationale: string;
}

/**
 * The "decisions" page: the rejected options and tradeoffs behind the change.
 * Only present when the change's alternatives were genuinely weighed (mined from
 * the authoring conversation/handoff), so it's absent on diff-only guides.
 */
export interface GuideDecisions {
  /** The options considered — the chosen one plus the rejected alternatives. */
  entries: GuideDecision[];
  /** One composed spoken script narrating the decision, played over the page. */
  narration: string;
}

/** Pre-rendered narration audio, keyed by the exact sentence text → clip URL. */
export interface GuideAudioManifest {
  voice: string;
  model: string;
  /** Sentence text → relative URL of its cached audio clip. */
  clips: Record<string, string>;
}

export interface GuideArtifact {
  meta: {
    title?: string;
    generatedAt: string;
  };
  /** One-line TL;DR shown on the overview screen — a glanceable summary, not a report. */
  summary?: string;
  /** One or two sentences that close the walkthrough — a recap shown as the final screen. */
  closing?: string;
  /** Optional big-picture briefing the player shows before the per-function steps. */
  overview?: GuideOverview;
  /** Pre-rendered narration audio (present when a TTS key was configured at author time). */
  audio?: GuideAudioManifest;
  /** Ordered walkthrough — one step per changed node, in the order the LLM curated. */
  steps: GuideStep[];
  /** Optional rejected-options/tradeoffs page, shown after the steps (context-aware guides only). */
  decisions?: GuideDecisions;
  /** Optional embedded subgraph for standalone/LLM use; the player latches onto the live graph. */
  subgraph?: {
    nodes: GuideSubgraphNode[];
    edges: FlowEdge[];
  };
}

// ── Guide authoring (POST /guide) ────────────────────────────────────────────
// The skill sends SEMANTIC steps; the server resolves each to a real graph node,
// relativizes ids, validates, and writes the artifact. This keeps the brittle
// id-construction off the LLM.

/** One narration sentence as authored by the skill — focus is a CODE SNIPPET,
 *  not a line number; the server maps it to the diff lines it appears on. */
export interface GuideAuthorNarration {
  text: string;
  /** A snippet of the changed code to highlight while this sentence plays. */
  focus?: string;
  /**
   * Force which diff pane the focus highlights. Use "before" to point at the
   * prior code when narrating what the function did before the change. Default
   * searches the after pane first, then before.
   */
  focusSide?: 'before' | 'after';
}

export interface GuideAuthorStep {
  /** Function name to locate in the live graph. */
  methodName: string;
  /** A file path or basename to disambiguate (e.g. "orders.controller.ts"). */
  file: string;
  /** Optional class name to further disambiguate same-named methods. */
  className?: string;
  changeType: GuideChangeType;
  /** Ordered narration; the server snapshots the diff and resolves each focus. */
  narration: GuideAuthorNarration[];
}

export interface GuideAuthorInput {
  slug: string;
  title?: string;
  /** One-line TL;DR for the overview screen. */
  summary?: string;
  /** Closing recap sentence(s) for the final screen. */
  closing?: string;
  /**
   * Git ref to diff against for before/after. Defaults to "HEAD" (uncommitted
   * working-tree changes). Set it to the commit before your change when the
   * change is already committed, so edited functions still show a real before.
   */
  base?: string;
  /** Optional big-picture briefing (before-state + what changed). */
  overview?: GuideOverview;
  /**
   * Optional rejected-options/tradeoffs page. Include ONLY when alternatives were
   * genuinely weighed in the conversation; the server omits it if entries or the
   * composed narration are empty.
   */
  decisions?: GuideDecisions;
  steps: GuideAuthorStep[];
}

/** A step the server could not resolve to exactly one live node, with the reason. */
export interface GuideUnresolvedStep extends GuideAuthorStep {
  reason: string;
  /** When the match was ambiguous, the candidate files so the LLM can disambiguate. */
  candidates?: string[];
}

export interface GuideAuthorResult {
  slug: string;
  url: string;
  resolved: number;
  total: number;
  unresolved: GuideUnresolvedStep[];
}

export interface CacheEntry {
  bodyHash: string;
  summary: string;
  cachedAt: string;
}

export interface CacheIndex {
  [nodeId: string]: CacheEntry;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  meta?: Record<string, unknown>;
}
