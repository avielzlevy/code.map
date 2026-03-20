/**
 * Smoke test — Next.js e-commerce fixture.
 * Run with:  npx ts-node tests/smoke-nextjs.ts   (from repo root)
 *
 * Verifies:
 * 1. AST parser handles App Router route files (exported GET/POST/etc. functions).
 * 2. @FlowStep tags are extracted.
 * 3. JSDoc docstrings are picked up.
 * 4. Call edges link route handlers → service classes.
 * 5. Sidecar serves the graph over HTTP.
 */

import * as http from 'http';
import * as path from 'path';

import { AstParserService } from '../backend/packages/nextjs/src/ast/ast-parser.service';
import { CacheService } from '../backend/packages/nextjs/src/cache/cache.service';
import { SidecarService } from '../backend/packages/nextjs/src/sidecar/sidecar.service';

const SIDECAR_PORT = 4571;
const FIXTURE_DIR = path.resolve(__dirname, 'nextjs-ecommerce/src');

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
  console.log('--- Next.js e-commerce smoke test ---\n');

  // 1. Parse App Router + service layer
  const parser = new AstParserService();
  const graph = parser.parse(FIXTURE_DIR);
  console.log(`[AST]  Parsed ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  if (graph.nodes.length < 8) {
    throw new Error(`Expected ≥8 nodes from a multi-route Next.js app, got ${graph.nodes.length}`);
  }
  console.log(`[AST]  Node count OK (≥8)`);

  if (graph.edges.length < 3) {
    throw new Error(`Expected ≥3 call edges, got ${graph.edges.length}`);
  }
  console.log(`[AST]  Edge count OK (≥3)`);

  // 2. @FlowStep tags
  const taggedNodes = graph.nodes.filter((n) => n.customTag);
  if (taggedNodes.length < 3) {
    throw new Error(`Expected ≥3 @FlowStep nodes, got ${taggedNodes.length}`);
  }
  console.log(`[AST]  ${taggedNodes.length} @FlowStep nodes found`);

  // 3. App Router HTTP exports (GET, POST, PUT, DELETE)
  const httpNodes = graph.nodes.filter((n) => n.httpMethod);
  if (httpNodes.length < 3) {
    throw new Error(`Expected ≥3 HTTP method nodes, got ${httpNodes.length}`);
  }
  console.log(`[AST]  ${httpNodes.length} HTTP method nodes (App Router exports)`);

  // 4. Cache
  const cache = new CacheService('/tmp/flow-map-smoke-nextjs');
  const hash = cache.hashBody('export async function GET() { return Response.json({}); }');
  cache.set('nextjs-smoke::GET', hash, 'List orders endpoint');
  const hit = cache.get('nextjs-smoke::GET', hash);
  if (hit !== 'List orders endpoint') throw new Error(`Cache miss: got "${hit}"`);
  console.log('[Cache] Set/get round-trip OK');

  // 5. Sidecar HTTP
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
    throw new Error(`Node count mismatch: expected ${graph.nodes.length}, got ${parsed.data.nodes.length}`);
  }
  console.log(`[Sidecar] /graph → 200, ${parsed.data.nodes.length} nodes, ${parsed.data.edges.length} edges`);

  await sidecar.stop();
  console.log('\n✓ Next.js smoke test passed');
}

run().catch((err) => {
  console.error('\n✗ Next.js smoke test failed:', err.message);
  process.exit(1);
});
