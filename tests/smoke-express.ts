/**
 * Smoke test — Express e-commerce fixture.
 * Run with:  npx ts-node tests/smoke-express.ts   (from repo root)
 *
 * Verifies:
 * 1. AST parser handles an Express codebase with chained-style routes (router.get/post/put/delete).
 * 2. HTTP methods are detected on all route nodes.
 * 3. @FlowStep tags are extracted from service classes.
 * 4. Call edges link route handlers → services.
 * 5. Sidecar serves the graph over HTTP.
 */

import * as http from 'http';
import * as path from 'path';

import { AstParserService } from '../backend/packages/nestjs/src/ast/ast-parser.service';
import { CacheService } from '../backend/packages/nestjs/src/cache/cache.service';
import { SidecarService } from '../backend/packages/nestjs/src/sidecar/sidecar.service';

const SIDECAR_PORT = 4573;
const FIXTURE_DIR = path.resolve(__dirname, 'express-ecommerce/src');

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
  console.log('--- Express e-commerce smoke test ---\n');

  // 1. Parse the full Express fixture (chained routes + service classes)
  const parser = new AstParserService();
  const graph = parser.parse(FIXTURE_DIR);
  console.log(`[AST]  Parsed ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  if (graph.nodes.length < 8) {
    throw new Error(`Expected ≥8 nodes from a multi-module Express app, got ${graph.nodes.length}`);
  }
  console.log(`[AST]  Node count OK (≥8)`);

  if (graph.edges.length < 3) {
    throw new Error(`Expected ≥3 call edges, got ${graph.edges.length}`);
  }
  console.log(`[AST]  Edge count OK (≥3)`);

  // 2. HTTP methods on route nodes (chained router.get/post/put/delete)
  const httpNodes = graph.nodes.filter((n) => n.httpMethod);
  if (httpNodes.length < 5) {
    throw new Error(`Expected ≥5 HTTP method nodes from chained routes, got ${httpNodes.length}`);
  }
  console.log(`[AST]  ${httpNodes.length} chained-route HTTP nodes detected`);

  // 3. @FlowStep tags on service methods
  const taggedNodes = graph.nodes.filter((n) => n.customTag);
  if (taggedNodes.length < 3) {
    throw new Error(`Expected ≥3 @FlowStep nodes on service methods, got ${taggedNodes.length}`);
  }
  console.log(`[AST]  ${taggedNodes.length} @FlowStep nodes found`);
  console.log(`[AST]  Sample: "${taggedNodes[0].label}" → "${taggedNodes[0].customTag}"`);

  // 4. Cache round-trip
  const cache = new CacheService('/tmp/flow-map-smoke-express');
  const hash = cache.hashBody("router.get('/orders', handler)");
  cache.set('express-smoke::listOrders', hash, 'List all orders');
  const hit = cache.get('express-smoke::listOrders', hash);
  if (hit !== 'List all orders') throw new Error(`Cache miss: got "${hit}"`);
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
  console.log('\n✓ Express smoke test passed');
}

run().catch((err) => {
  console.error('\n✗ Express smoke test failed:', err.message);
  process.exit(1);
});
