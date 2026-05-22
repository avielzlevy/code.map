/**
 * Endpoint test for the guide feature.
 * Parses the @code-map/nestjs package source, loads it into the sidecar (no
 * rebuild — the guide latches onto this in-memory graph), then hits /guide.
 *
 * Run from repo root:  ts-node tests/guide-endpoint.ts
 */
import * as http from 'http';
import * as path from 'path';

import { AstParserService } from '../backend/packages/nestjs/src/ast/ast-parser.service';
import { SidecarService } from '../backend/packages/nestjs/src/sidecar/sidecar.service';

const PORT = 4581;
const SRC = path.resolve(__dirname, '../backend/packages/nestjs/src');
const RANGE = { base: 'db0ed65~1', head: 'db0ed65' };

function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on('error', reject);
  });
}

async function run(): Promise<void> {
  const graph = new AstParserService().parse(SRC);
  const sidecar = new SidecarService();
  sidecar.updateGraph(graph);
  await sidecar.start(PORT);

  const url = `http://localhost:${PORT}/api/flow-map/guide?base=${RANGE.base}&head=${RANGE.head}`;
  const resp = await get(url);
  if (resp.status !== 200) throw new Error(`/guide returned ${resp.status}`);

  const guide = JSON.parse(resp.body).data;
  console.log('\n--- guide artifact ---');
  console.log('meta.commits:', guide.meta.commits.map((c: any) => `${c.hash} ${c.subject}`));
  console.log(`steps: ${guide.steps.length}`);
  guide.steps.forEach((s: any) =>
    console.log(`  [${s.status}] ${s.methodName}  ${s.nodeId}  (${s.diff.split('\n').length} diff lines)`),
  );
  console.log(`subgraph: ${guide.subgraph.nodes.length} nodes, ${guide.subgraph.edges.length} edges`);
  console.log('  changed:', guide.subgraph.nodes.filter((n: any) => n.role === 'changed').length);
  console.log('  context:', guide.subgraph.nodes.filter((n: any) => n.role === 'context').length);

  // Assertions
  const absLeak = JSON.stringify(guide).includes('/Users/');
  if (absLeak) throw new Error('ARTIFACT LEAKS ABSOLUTE PATH — ids not relativized');
  console.log('\n✓ no absolute paths in artifact (portable)');
  if (guide.steps.length === 0) throw new Error('no steps — diff mapped to zero nodes');
  console.log('✓ diff mapped to nodes');
  if (!guide.steps[0].diff) throw new Error('changed step missing diff text');
  console.log('✓ changed steps carry diff text');

  await sidecar.stop();
  console.log('\n✓ guide endpoint test passed\n');
}

run().catch((err) => {
  console.error('\n✗ guide endpoint test failed:', err.message);
  process.exit(1);
});
