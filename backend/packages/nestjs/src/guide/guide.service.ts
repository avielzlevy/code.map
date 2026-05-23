import * as fs from 'fs';
import * as path from 'path';

import { FlowLogger } from '../logger/flow-logger';
import { GuideException } from '../exceptions/flow-mapper.exceptions';
import { GUIDE_SAVE_DIR, GUIDE_SLUG_PATTERN, GUIDE_CHANGE_TYPES } from '../constants';
import {
  FlowGraph,
  GuideArtifact,
  GuideAuthorInput,
  GuideStep,
  GuideUnresolvedStep,
} from '../dto/flow-mapper-config.dto';

const LOGGER_CONTEXT = 'GuideService';

/**
 * Plays and authors guides under `.codemap/guides`. Authoring takes SEMANTIC
 * steps from the skill ({methodName, file, changeType, explanation}) and the
 * server resolves each to a real live-graph node, relativizes the id, and
 * validates — so the LLM never hand-constructs node ids or JSON.
 */
export class GuideService {
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
    const steps: GuideStep[] = [];
    const unresolved: GuideUnresolvedStep[] = [];

    for (const s of input.steps) {
      if (!s.methodName || !s.file || !s.explanation) {
        unresolved.push({ ...s, reason: 'missing methodName, file, or explanation' });
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
      steps.push({
        nodeId: rel(node.filePath) + node.id.slice(node.filePath.length),
        methodName: node.methodName,
        file: rel(node.filePath),
        type: node.type,
        changeType: s.changeType,
        explanation: s.explanation,
      });
    }

    FlowLogger.info(LOGGER_CONTEXT, 'Authored guide', {
      slug: input.slug,
      resolved: steps.length,
      unresolved: unresolved.length,
    });

    return {
      artifact: { meta: { title: input.title, generatedAt: new Date().toISOString() }, steps },
      unresolved,
    };
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
