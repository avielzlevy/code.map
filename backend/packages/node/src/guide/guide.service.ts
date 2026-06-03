import * as fs from 'fs';
import * as path from 'path';

import { FlowLogger } from '../logger/flow-logger';
import { GuideException } from '../exceptions/code-map.exceptions';
import { GUIDE_SAVE_DIR, GUIDE_SLUG_PATTERN, GUIDE_CHANGE_TYPES } from '../constants';
import {
  FlowGraph,
  GuideArtifact,
  GuideAuthorInput,
  GuideDiff,
  GuideFocus,
  GuideNarrationSegment,
  GuideOverview,
  GuideStep,
  GuideUnresolvedStep,
} from '../dto/code-map-config.dto';
import { GuideDiffService } from './guide-diff.service';

const LOGGER_CONTEXT = 'GuideService';

/**
 * Plays and authors guides under `.codemap/guides`. Authoring takes SEMANTIC
 * steps from the skill ({methodName, file, changeType, explanation}) and the
 * server resolves each to a real live-graph node, relativizes the id, and
 * validates — so the LLM never hand-constructs node ids or JSON.
 */
export class GuideService {
  constructor(private readonly diffService: GuideDiffService = new GuideDiffService()) {}

  /**
   * Resolve semantic steps against the live graph into a portable artifact.
   * Returns the artifact (resolved steps only) plus any steps that couldn't be
   * matched, with reasons — so the caller can give the LLM actionable feedback.
   */
  author(
    graph: FlowGraph,
    repoRoot: string,
    input: GuideAuthorInput,
  ): { artifact: GuideArtifact; unresolved: GuideUnresolvedStep[] } {
    const rel = (abs: string): string => path.relative(repoRoot, abs);
    const base = input.base?.trim() || 'HEAD';
    const steps: GuideStep[] = [];
    const unresolved: GuideUnresolvedStep[] = [];

    for (const s of input.steps) {
      if (!s.methodName || !s.file || !Array.isArray(s.narration) || s.narration.length === 0) {
        unresolved.push({ ...s, reason: 'missing methodName, file, or narration' });
        continue;
      }
      if (!GUIDE_CHANGE_TYPES.includes(s.changeType)) {
        unresolved.push({ ...s, reason: `changeType must be one of ${GUIDE_CHANGE_TYPES.join(', ')}` });
        continue;
      }
      if (s.changeType === 'removed') {
        unresolved.push({ ...s, reason: 'removed functions are not in the graph yet (ghost nodes unsupported)' });
        continue;
      }

      const matches = graph.nodes.filter(
        (n) =>
          n.methodName === s.methodName &&
          n.filePath.includes(s.file) &&
          (!s.className || n.id.includes(`:${s.className}#`)),
      );

      if (matches.length === 0) {
        unresolved.push({ ...s, reason: 'no matching function in the live graph' });
        continue;
      }
      if (matches.length > 1) {
        unresolved.push({
          ...s,
          reason: 'ambiguous — multiple matches; pass a more specific file or className',
          candidates: matches.map((m) => rel(m.filePath)),
        });
        continue;
      }

      const node = matches[0];
      const relFile = rel(node.filePath);
      const diff = this.diffService.snapshot(
        repoRoot,
        relFile,
        node.methodName,
        node.lineNumber,
        s.changeType,
        base,
      );
      const narration: GuideNarrationSegment[] = s.narration.map((n) => {
        const focus = n.focus ? this.mapFocus(diff, n.focus, n.focusSide) : undefined;
        return focus ? { text: n.text, focus } : { text: n.text };
      });
      steps.push({
        nodeId: relFile + node.id.slice(node.filePath.length),
        methodName: node.methodName,
        file: relFile,
        type: node.type,
        changeType: s.changeType,
        narration,
        diff,
        explanation: narration[0]?.text ?? '',
      });
    }

    const overview = this.cleanOverview(input.overview);
    const summary = input.summary?.trim() || undefined;
    const closing = input.closing?.trim() || undefined;

    FlowLogger.info(LOGGER_CONTEXT, 'Authored guide', {
      slug: input.slug,
      resolved: steps.length,
      unresolved: unresolved.length,
      hasOverview: !!overview,
      hasSummary: !!summary,
      hasClosing: !!closing,
    });

    return {
      artifact: {
        meta: { title: input.title, generatedAt: new Date().toISOString() },
        ...(summary ? { summary } : {}),
        ...(closing ? { closing } : {}),
        ...(overview ? { overview } : {}),
        steps,
      },
      unresolved,
    };
  }

  /**
   * Resolve a focus SNIPPET to an inclusive line range within the diff. Prefers
   * the after pane (where new code lives); falls back to before. Returns the span
   * from the first to the last line containing the snippet, or undefined if absent.
   */
  private mapFocus(
    diff: GuideDiff,
    snippet: string,
    side?: 'before' | 'after',
  ): GuideFocus | undefined {
    // Match on collapsed whitespace so an LLM's snippet lands even if its spacing
    // or indentation differs slightly from the source line.
    const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
    const needle = norm(snippet);
    if (!needle) return undefined;

    const search = (
      lines: GuideDiff['after'],
      paneSide: GuideFocus['side'],
    ): GuideFocus | undefined => {
      if (!lines) return undefined;
      const hits: number[] = [];
      lines.forEach((l, i) => {
        if (norm(l.text).includes(needle)) hits.push(i);
      });
      if (hits.length === 0) return undefined;
      return { side: paneSide, lines: [hits[0], hits[hits.length - 1]] };
    };

    // Respect an explicit side (e.g. narrating the prior code); else after, then before.
    if (side === 'before') return search(diff.before, 'before');
    if (side === 'after') return search(diff.after, 'after');
    return search(diff.after, 'after') ?? search(diff.before, 'before');
  }

  /** Trim/drop empty briefing sentences; return undefined when there's nothing to show. */
  private cleanOverview(overview: GuideOverview | undefined): GuideOverview | undefined {
    if (!overview) return undefined;
    const clean = (lines: string[] | undefined): string[] =>
      Array.isArray(lines) ? lines.map((l) => l.trim()).filter((l) => l.length > 0) : [];
    const before = clean(overview.before);
    const change = clean(overview.change);
    if (before.length === 0 && change.length === 0) return undefined;
    return { before, change };
  }

  /** Persist an artifact to `.codemap/guides/<slug>.json`. */
  save(repoRoot: string, slug: string, artifact: GuideArtifact): void {
    if (!GUIDE_SLUG_PATTERN.test(slug)) {
      throw new GuideException(slug, 'invalid guide slug');
    }
    const dir = path.join(repoRoot, GUIDE_SAVE_DIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(artifact, null, 2));
  }

  /** Read a saved guide from `.codemap/guides/<slug>.json`. */
  loadSaved(repoRoot: string, slug: string): GuideArtifact {
    if (!GUIDE_SLUG_PATTERN.test(slug)) {
      throw new GuideException(slug, 'invalid guide slug');
    }
    const file = path.join(repoRoot, GUIDE_SAVE_DIR, `${slug}.json`);
    if (!fs.existsSync(file)) {
      throw new GuideException(slug, 'guide not found');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new GuideException(slug, `invalid guide JSON: ${(err as Error).message}`);
    }
    if (!parsed || !Array.isArray((parsed as GuideArtifact).steps)) {
      throw new GuideException(slug, 'guide is missing a steps array');
    }
    return parsed as GuideArtifact;
  }

  /** List available saved guide slugs under `.codemap/guides`. */
  listSaved(repoRoot: string): string[] {
    const dir = path.join(repoRoot, GUIDE_SAVE_DIR);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length));
  }
}
