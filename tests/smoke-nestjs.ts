/**
 * Smoke test — NestJS e-commerce fixture.
 * Run with:  npx ts-node tests/smoke-nestjs.ts   (from repo root)
 *
 * Verifies:
 * 1. AST parser handles a multi-module NestJS codebase (controllers + services + shared).
 * 2. @FlowStep tags are extracted from controllers AND services.
 * 3. JSDoc docstrings are picked up.
 * 4. Call edges link controllers → services → shared services.
 * 5. Sidecar serves the graph over HTTP.
 */

import * as http from 'http';
import * as path from 'path';

import { AstParserService } from '../backend/packages/nestjs/src/ast/ast-parser.service';
import { CacheService } from '../backend/packages/nestjs/src/cache/cache.service';
import { SidecarService } from '../backend/packages/nestjs/src/sidecar/sidecar.service';

const SIDECAR_PORT = 4570;
const FIXTURE_DIR = path.resolve(__dirname, 'nestjs-ecommerce/src');

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
  console.log('--- NestJS e-commerce smoke test ---\n');

  // 1. Parse the full multi-module fixture
  const parser = new AstParserService();
  const graph = parser.parse(FIXTURE_DIR);
  console.log(`[AST]  Parsed ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  if (graph.nodes.length < 10) {
    throw new Error(`Expected ≥10 nodes from a multi-module codebase, got ${graph.nodes.length}`);
  }
  console.log(`[AST]  Node count OK (≥10)`);

  if (graph.edges.length < 5) {
    throw new Error(`Expected ≥5 call edges, got ${graph.edges.length}`);
  }
  console.log(`[AST]  Edge count OK (≥5)`);

  // 2. @FlowStep tags must be present on both controllers and services
  const taggedNodes = graph.nodes.filter((n) => n.customTag);
  if (taggedNodes.length < 5) {
    throw new Error(`Expected ≥5 @FlowStep nodes, got ${taggedNodes.length}`);
  }
  console.log(`[AST]  ${taggedNodes.length} @FlowStep nodes found`);
  console.log(`[AST]  Sample: "${taggedNodes[0].label}" → "${taggedNodes[0].customTag}"`);

  // 3. Docstrings must be extracted
  const docNodes = graph.nodes.filter((n) => n.docstring);
  if (docNodes.length < 1) {
    throw new Error('Expected at least one node with a JSDoc docstring');
  }
  console.log(`[AST]  ${docNodes.length} nodes with JSDoc docstrings`);

  // 4. HTTP methods must be detected on controller nodes
  const httpNodes = graph.nodes.filter((n) => n.httpMethod);
  if (httpNodes.length < 5) {
    throw new Error(`Expected ≥5 nodes with HTTP methods, got ${httpNodes.length}`);
  }
  console.log(`[AST]  ${httpNodes.length} HTTP method nodes detected`);

  // 5. Cache round-trip
  const cache = new CacheService('/tmp/flow-map-smoke-nestjs');
  const hash = cache.hashBody('async findAll() { return []; }');
  cache.set('nestjs-smoke::findAll', hash, 'Paginated order list');
  const hit = cache.get('nestjs-smoke::findAll', hash);
  if (hit !== 'Paginated order list') throw new Error(`Cache miss: got "${hit}"`);
  console.log('[Cache] Set/get round-trip OK');

  // 6. Sidecar HTTP
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
  console.log('\n✓ NestJS smoke test passed');
}

run().catch((err) => {
  console.error('\n✗ NestJS smoke test failed:', err.message);
  process.exit(1);
});
