import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { FlowLogger } from '../logger/flow-logger';
import { GuideException } from '../exceptions/flow-mapper.exceptions';
import {
  GUIDE_SUBGRAPH_DEPTH,
  GUIDE_TRUNK_FALLBACKS,
  GUIDE_SAVE_DIR,
  GUIDE_SLUG_PATTERN,
} from '../constants';
import {
  FlowGraph,
  FlowNode,
  GuideArtifact,
  GuideCommit,
  GuideStep,
  GuideSubgraphNode,
} from '../dto/flow-mapper-config.dto';

const LOGGER_CONTEXT = 'GuideService';

interface DiffLine {
  file: string;
  /** New-side line number this changed line sits at — used to attribute it to a function. */
  newLine: number;
  /** Raw diff line, e.g. "+  return x;" or "-  return y;". */
  text: string;
}

/**
 * Builds a portable guide artifact by mapping a git diff onto the LIVE graph.
 * It never re-parses the codebase — it latches onto the graph the sidecar
 * already holds in memory. All ids/paths are normalized to repo-relative so
 * the artifact is shareable and reproducible on any checkout of the same code.
 */
export class GuideService {
  build(graph: FlowGraph, repoRoot: string, baseOpt: string | undefined, head: string): GuideArtifact {
    const base = baseOpt ?? this.resolveTrunk(repoRoot);
    FlowLogger.info(LOGGER_CONTEXT, 'Building guide', { base, head });

    const diffLines = this.diffLines(repoRoot, base, head);
    const commits = this.commits(repoRoot, base, head);

    const rel = (abs: string): string => path.relative(repoRoot, abs);
    const relId = (node: FlowNode): string => rel(node.filePath) + node.id.slice(node.filePath.length);

    // 1. Map changed lines → nodes by attributing each line to the function whose
    //    line range contains it. A node is a step only if it owns ≥1 changed line,
    //    and its diff is just those lines — not the whole file's hunk.
    const narration = commits.map((c) => c.subject).join(' / ');
    const steps: GuideStep[] = [];
    const changedAbsIds = new Set<string>();

    for (const node of graph.nodes) {
      const file = rel(node.filePath);
      const [start, end] = this.nodeRange(node);
      const ownLines = diffLines.filter(
        (l) => l.file === file && l.newLine >= start && l.newLine <= end,
      );
      if (ownLines.length === 0) continue;

      changedAbsIds.add(node.id);
      steps.push({
        nodeId: relId(node),
        methodName: node.methodName,
        file,
        type: node.type,
        lineRange: [start, end],
        status: 'modified',
        narration,
        diff: ownLines.map((l) => l.text).join('\n'),
      });
    }

    // 2. Expand to a depth-bounded subgraph (callers + callees of changed nodes).
    const subgraphAbsIds = this.expandSubgraph(graph, changedAbsIds, GUIDE_SUBGRAPH_DEPTH);

    const idMap = new Map<string, string>();
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    for (const absId of subgraphAbsIds) {
      const node = nodeById.get(absId);
      if (node) idMap.set(absId, relId(node));
    }

    const subgraphNodes: GuideSubgraphNode[] = [];
    for (const absId of subgraphAbsIds) {
      const node = nodeById.get(absId);
      if (!node) continue;
      subgraphNodes.push({
        id: idMap.get(absId)!,
        label: node.label,
        methodName: node.methodName,
        type: node.type,
        file: rel(node.filePath),
        line: node.lineNumber,
        role: changedAbsIds.has(absId) ? 'changed' : 'context',
      });
    }

    const subgraphEdges = graph.edges
      .filter((e) => subgraphAbsIds.has(e.from) && subgraphAbsIds.has(e.to))
      .map((e) => ({ from: idMap.get(e.from)!, to: idMap.get(e.to)!, callOrder: e.callOrder }));

    const changedFiles = new Set(diffLines.map((l) => l.file));
    FlowLogger.info(LOGGER_CONTEXT, 'Guide built', {
      steps: steps.length,
      subgraphNodes: subgraphNodes.length,
      subgraphEdges: subgraphEdges.length,
      diffLines: diffLines.length,
      changedFiles: changedFiles.size,
    });

    // Diagnose the common silent failure: the diff had changes but none landed on a
    // graph node — usually a path-base mismatch (repoRoot vs how git reports paths)
    // or the changed files simply contain no parsed functions.
    if (steps.length === 0 && diffLines.length > 0) {
      FlowLogger.warn(LOGGER_CONTEXT, 'Diff has changes but none mapped to graph nodes', {
        sampleDiffFiles: [...changedFiles].slice(0, 5),
        sampleGraphFiles: [...new Set(graph.nodes.map((n) => rel(n.filePath)))].slice(0, 5),
        repoRoot,
      });
    }

    return {
      meta: { base, head, generatedAt: new Date().toISOString(), commits },
      steps,
      subgraph: { nodes: subgraphNodes, edges: subgraphEdges },
    };
  }

  /** Read a skill-authored guide from `.codemap/guides/<slug>.json`. */
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

  /** A node spans [lineNumber, lineNumber + body line count - 1]. */
  private nodeRange(node: FlowNode): [number, number] {
    const lines = node.rawBody ? node.rawBody.split('\n').length : 1;
    return [node.lineNumber, node.lineNumber + lines - 1];
  }

  /** Breadth-first expansion over call edges, up to `depth` hops. */
  private expandSubgraph(graph: FlowGraph, seed: Set<string>, depth: number): Set<string> {
    const result = new Set(seed);
    let frontier = new Set(seed);
    for (let hop = 0; hop < depth; hop++) {
      const next = new Set<string>();
      for (const edge of graph.edges) {
        if (frontier.has(edge.from) && !result.has(edge.to)) next.add(edge.to);
        if (frontier.has(edge.to) && !result.has(edge.from)) next.add(edge.from);
      }
      if (next.size === 0) break;
      next.forEach((id) => result.add(id));
      frontier = next;
    }
    return result;
  }

  /**
   * Parse `git diff --unified=0` into individual changed lines, each tagged with
   * the new-side line number it sits at. This lets the caller attribute each line
   * to the specific function whose range contains it, instead of dumping a whole
   * file's hunk onto every node in that file.
   *
   * Three-dot (`base...head`) so only the branch's own changes are shown — not
   * commits that landed on the base after the fork point.
   */
  private diffLines(repoRoot: string, base: string, head: string): DiffLine[] {
    const range = `${base}...${head}`;
    const diff = this.git(repoRoot, range, `diff ${range} --unified=0`);
    const result: DiffLine[] = [];
    let file = '';
    let newLine = 0;
    let inHunk = false;

    for (const line of diff.split('\n')) {
      if (line.startsWith('diff --git')) {
        inHunk = false;
      } else if (line.startsWith('+++ b/')) {
        file = line.slice('+++ b/'.length).trim();
        inHunk = false;
      } else if (line.startsWith('---')) {
        // old-file header — ignore
      } else if (line.startsWith('@@')) {
        const m = line.match(/\+(\d+)(?:,(\d+))?/);
        if (m) {
          newLine = parseInt(m[1], 10);
          inHunk = true;
        }
      } else if (inHunk && line.startsWith('+')) {
        result.push({ file, newLine, text: line });
        newLine++;
      } else if (inHunk && line.startsWith('-')) {
        // Removed line — sits at the current new-side position; doesn't advance it.
        result.push({ file, newLine, text: line });
      }
    }
    return result;
  }

  /** Two-dot (`base..head`) — commits reachable from head but not base. */
  private commits(repoRoot: string, base: string, head: string): GuideCommit[] {
    const range = `${base}..${head}`;
    const log = this.git(repoRoot, range, `log --format=%H%x09%s ${range}`).trim();
    if (!log) return [];
    return log.split('\n').map((l) => {
      const tab = l.indexOf('\t');
      return { hash: l.slice(0, 7), subject: tab >= 0 ? l.slice(tab + 1) : '' };
    });
  }

  /**
   * Resolve the trunk ref to compare against: the remote default branch
   * (origin/HEAD), falling back to local main, then master.
   */
  private resolveTrunk(repoRoot: string): string {
    const remoteHead = this.tryGit(repoRoot, 'symbolic-ref --quiet refs/remotes/origin/HEAD');
    if (remoteHead) return remoteHead.trim().replace('refs/remotes/', ''); // → origin/main

    for (const name of GUIDE_TRUNK_FALLBACKS) {
      if (this.tryGit(repoRoot, `rev-parse --verify --quiet refs/remotes/origin/${name}`)) {
        return `origin/${name}`;
      }
      if (this.tryGit(repoRoot, `rev-parse --verify --quiet refs/heads/${name}`)) {
        return name;
      }
    }
    throw new GuideException('trunk', 'could not resolve a default branch (main/master)');
  }

  private git(repoRoot: string, range: string, args: string): string {
    try {
      return execSync(`git ${args}`, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch (err) {
      throw new GuideException(range, (err as Error).message);
    }
  }

  /** Run git, returning null instead of throwing — for ref-detection probes. */
  private tryGit(repoRoot: string, args: string): string | null {
    try {
      return execSync(`git ${args}`, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      return null;
    }
  }
}
