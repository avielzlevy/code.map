/**
 * Viability PoC for the commit/branch guide.
 * Pipeline: parse FlowGraph (at HEAD) -> git diff a range -> map hunks to nodes
 *           -> expand 1-hop subgraph -> attach commit messages -> emit JSON.
 *
 * Run:  ts-node tests/guide-poc.ts [gitRange]
 *       (default range: db0ed65~1..db0ed65 — a real 114-line AstParser change)
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { AstParserService } from '../backend/packages/nestjs/src/ast/ast-parser.service';
import {
  FlowGraph,
  FlowNode,
} from '../backend/packages/nestjs/src/dto/flow-mapper-config.dto';

const REPO = path.resolve(__dirname, '..');
const SRC = path.resolve(REPO, 'backend/packages/nestjs/src');
const SRC_REL = path.relative(REPO, SRC);
const RANGE = process.argv[2] || 'db0ed65~1..db0ed65';

function git(args: string): string {
  return execSync(`git ${args}`, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

/** A node spans [lineNumber, lineNumber + body line count - 1]. */
function nodeRange(n: FlowNode): [number, number] {
  const lines = n.rawBody ? n.rawBody.split('\n').length : 1;
  return [n.lineNumber, n.lineNumber + lines - 1];
}

function relPath(fp: string): string {
  return path.isAbsolute(fp) ? path.relative(REPO, fp) : fp;
}

interface Hunk {
  file: string;
  start: number;
  end: number;
}

/** Parse the new-side line ranges from a `--unified=0` diff. */
function parseHunks(diff: string): Hunk[] {
  const hunks: Hunk[] = [];
  let file = '';
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      file = line.slice('+++ b/'.length).trim();
    } else if (line.startsWith('@@')) {
      const m = line.match(/\+(\d+)(?:,(\d+))?/);
      if (!m) continue;
      const start = parseInt(m[1], 10);
      const count = m[2] ? parseInt(m[2], 10) : 1;
      if (count > 0) hunks.push({ file, start, end: start + count - 1 });
    }
  }
  return hunks;
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return !(a[1] < b[0] || a[0] > b[1]);
}

function main(): void {
  console.log(`\n=== Guide PoC — range: ${RANGE} ===\n`);

  // 1. Build the graph at HEAD.
  const graph: FlowGraph = new AstParserService().parse(SRC);
  console.log(`[graph] ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  // 2. Diff the range, restricted to the parsed source root.
  const diff = git(`diff ${RANGE} --unified=0 -- '${SRC_REL}'`);
  const hunks = parseHunks(diff);
  const files = [...new Set(hunks.map((h) => h.file))];
  console.log(`[diff]  ${hunks.length} hunks across ${files.length} file(s):`);
  files.forEach((f) => console.log(`          ${f}`));

  // 3. Map hunks -> nodes (file match + line-range overlap).
  const changed = graph.nodes.filter((n) => {
    const nr = nodeRange(n);
    const rel = relPath(n.filePath);
    return hunks.some((h) => rel === h.file && overlaps(nr, [h.start, h.end]));
  });
  console.log(`\n[map]   ${changed.length} changed node(s):`);
  changed.forEach((n) => {
    const [s, e] = nodeRange(n);
    console.log(`          ${n.type.padEnd(10)} ${n.methodName}  (${relPath(n.filePath)}:${s}-${e})`);
  });

  // 4. Expand to a 1-hop subgraph (callers + callees of changed nodes).
  const changedIds = new Set(changed.map((n) => n.id));
  const neighborIds = new Set<string>();
  for (const e of graph.edges) {
    if (changedIds.has(e.from)) neighborIds.add(e.to);
    if (changedIds.has(e.to)) neighborIds.add(e.from);
  }
  changedIds.forEach((id) => neighborIds.delete(id));
  const neighbors = graph.nodes.filter((n) => neighborIds.has(n.id));
  console.log(`\n[subgraph] ${neighbors.length} neighbor node(s) (1-hop):`);
  neighbors.forEach((n) =>
    console.log(`          ${n.type.padEnd(10)} ${n.methodName}  (${relPath(n.filePath)})`),
  );

  // 5. Narration from commit messages in the range (no AI).
  const log = git(`log --format=%H%x09%s ${RANGE}`).trim();
  const commits = log
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [hash, ...rest] = l.split('\t');
      return { hash: hash.slice(0, 7), subject: rest.join('\t') };
    });
  console.log(`\n[narration] ${commits.length} commit(s):`);
  commits.forEach((c) => console.log(`          ${c.hash}  ${c.subject}`));

  // 6. Serialize the portable artifact.
  const subgraphIds = new Set([...changedIds, ...neighborIds]);
  const artifact = {
    meta: {
      range: RANGE,
      sourceRoot: SRC_REL,
      generatedAt: new Date().toISOString(),
      commits,
    },
    subgraph: {
      nodes: graph.nodes
        .filter((n) => subgraphIds.has(n.id))
        .map((n) => ({
          id: n.id,
          label: n.label,
          methodName: n.methodName,
          type: n.type,
          file: relPath(n.filePath),
          line: n.lineNumber,
          role: changedIds.has(n.id) ? 'changed' : 'context',
        })),
      edges: graph.edges.filter(
        (e) => subgraphIds.has(e.from) && subgraphIds.has(e.to),
      ),
    },
    steps: changed.map((n) => {
      const [s, e] = nodeRange(n);
      return {
        nodeId: n.id,
        methodName: n.methodName,
        file: relPath(n.filePath),
        lineRange: [s, e],
        status: 'modified',
        narration: commits.map((c) => c.subject).join(' / '),
      };
    }),
  };

  const out = '/tmp/codemap-guide-poc.json';
  fs.writeFileSync(out, JSON.stringify(artifact, null, 2));
  console.log(`\n[artifact] wrote ${out}`);
  console.log(
    `           ${artifact.subgraph.nodes.length} nodes, ${artifact.subgraph.edges.length} edges, ${artifact.steps.length} steps\n`,
  );

  if (changed.length === 0) {
    console.error('✗ VIABILITY FAIL: diff mapped to zero nodes');
    process.exit(1);
  }
  console.log('✓ VIABILITY OK: diff mapped to graph nodes\n');
}

main();
