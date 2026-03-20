/**
 * Dev server — parse a test fixture and serve the UI.
 * Usage:  npx ts-node tests/dev-serve.ts [nestjs|nextjs]
 *         defaults to nestjs
 *
 * Open http://localhost:4580 in your browser.
 */

import * as path from 'path';
import { AstParserService } from '../backend/packages/nestjs/src/ast/ast-parser.service';
import { CacheService } from '../backend/packages/nestjs/src/cache/cache.service';
import { SidecarService } from '../backend/packages/nestjs/src/sidecar/sidecar.service';
import { FlowMapperService } from '../backend/packages/nestjs/src/flow-mapper/flow-mapper.service';

const PORT = 4580;

const FIXTURES: Record<string, string> = {
  nestjs: path.resolve(__dirname, 'nestjs-ecommerce/src'),
  nextjs: path.resolve(__dirname, 'nextjs-ecommerce/src'),
};

const target = process.argv[2] ?? 'nestjs';
const fixtureDir = FIXTURES[target];

if (!fixtureDir) {
  console.error(`Unknown target "${target}". Use: nestjs | nextjs`);
  process.exit(1);
}

async function run(): Promise<void> {
  console.log(`\nParsing ${target} fixture at:\n  ${fixtureDir}\n`);

  const astParser = new AstParserService();
  const cache = new CacheService('/tmp/flow-map-dev');
  const sidecar = new SidecarService();
  const flowMapper = new FlowMapperService(
    { port: PORT, enableAI: false, apiKey: '', provider: '', model: undefined, cachePath: '/tmp/flow-map-dev', sourceRoot: fixtureDir },
    astParser,
    cache,
    sidecar,
    null,
  );

  await flowMapper.buildAndServeGraph();
  await sidecar.start(PORT);

  console.log(`\n  Open → http://localhost:${PORT}\n`);
  console.log('  Ctrl+C to stop\n');
}

run().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
