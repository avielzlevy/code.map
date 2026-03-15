/**
 * End-to-end smoke test.
 * Run with:  npx ts-node test/smoke.ts
 *
 * Verifies:
 * 1. AST parser produces a valid graph from the fixture directory.
 * 2. Sidecar server starts and serves the graph on the configured port.
 * 3. Health endpoint returns 200.
 * 4. Graph endpoint returns the parsed nodes.
 */

import * as http from 'http';
import * as path from 'path';

import { AstParserService } from '../src/ast/ast-parser.service';
import { CacheService } from '../src/cache/cache.service';
import { SidecarService } from '../src/sidecar/sidecar.service';

const SIDECAR_PORT = 4568; // Use a different port so it doesn't conflict with production
const FIXTURE_DIR = path.resolve(__dirname, 'fixtures');

function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    }).on('error', reject);
  });
}

async function run(): Promise<void> {
  console.log('--- FlowMapper smoke test ---\n');

  // 1. Parse fixtures
  const parser = new AstParserService();
  const graph = parser.parse(FIXTURE_DIR);
  console.log(`[AST]  Parsed ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  const taggedNode = graph.nodes.find((n) => n.customTag);
  if (!taggedNode) throw new Error('Expected at least one node with a @FlowStep tag');
  console.log(`[AST]  @FlowStep node → label: "${taggedNode.label}"`);

  const docstringNode = graph.nodes.find((n) => n.docstring);
  if (!docstringNode) throw new Error('Expected at least one node with a JSDoc docstring');
  console.log(`[AST]  JSDoc node → docstring: "${docstringNode.docstring?.slice(0, 60)}..."`);

  // 2. Cache round-trip
  const cache = new CacheService('/tmp/flow-map-smoke-cache');
  const hash = cache.hashBody('function test() {}');
  cache.set('smoke::test', hash, 'Test summary');
  const hit = cache.get('smoke::test', hash);
  if (hit !== 'Test summary') throw new Error(`Cache miss after set: got "${hit}"`);
  console.log('[Cache] Set/get round-trip OK');

  const miss = cache.get('smoke::test', 'different-hash');
  if (miss !== undefined) throw new Error('Expected undefined on hash mismatch');
  console.log('[Cache] Hash-mismatch returns undefined OK');

  // 3. Sidecar start + HTTP verification
  const sidecar = new SidecarService();
  sidecar.updateGraph(graph);
  await sidecar.start(SIDECAR_PORT);
  console.log(`[Sidecar] Started on http://localhost:${SIDECAR_PORT}`);

  const health = await get(`http://localhost:${SIDECAR_PORT}/api/flow-map/health`);
  if (health.status !== 200) throw new Error(`Health returned ${health.status}`);
  console.log('[Sidecar] /health → 200 OK');

  const graphResp = await get(`http://localhost:${SIDECAR_PORT}/api/flow-map/graph`);
  if (graphResp.status !== 200) throw new Error(`/graph returned ${graphResp.status}`);
  const parsed = JSON.parse(graphResp.body);
  if (parsed.data.nodes.length !== graph.nodes.length) {
    throw new Error(`Expected ${graph.nodes.length} nodes in API response, got ${parsed.data.nodes.length}`);
  }
  console.log(`[Sidecar] /graph → 200, ${parsed.data.nodes.length} nodes, ${parsed.data.edges.length} edges`);

  await sidecar.stop();
  console.log('\n✓ All smoke checks passed');
}

run().catch((err) => {
  console.error('\n✗ Smoke test failed:', err.message);
  process.exit(1);
});
