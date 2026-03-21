import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const DESCRIPTORS_FILE = require('./framework-descriptors.json') as DescriptorsFile;

export interface FrameworkDescriptor {
  language: 'typescript' | 'python';
  displayName: string;
  detection: { manifestFile: string; manifestKey: string };
  routeStyle: 'decorator' | 'chained' | 'export' | 'mixed';
  controllerDecorators: string[];
  serviceDecorators: string[];
  routeDecorators: string[];
  flowStepDecorator: string;
  httpMethodMap: Record<string, string>;
  chainedRoute?: { receiverNames: string[]; methods: string[] };
  exportRoute?: { filePattern: string; exportedNames: string[] };
  viewsetMethods?: string[];
}

interface DescriptorsFile {
  version: string;
  frameworks: Record<string, FrameworkDescriptor>;
}

/**
 * Detection priority order for TypeScript frameworks.
 * More specific frameworks first so NestJS wins over Express when both are present.
 */
const TS_PRIORITY = ['nestjs', 'nextjs', 'hono', 'fastify', 'express'];

export function detectFramework(sourceRoot: string): FrameworkDescriptor {
  const frameworks = DESCRIPTORS_FILE.frameworks;

  const pkgPath = path.join(sourceRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, Record<string, string>>;
      const allDeps = {
        ...pkg['dependencies'],
        ...pkg['devDependencies'],
        ...pkg['peerDependencies'],
      };

      for (const key of TS_PRIORITY) {
        const desc = frameworks[key];
        if (!desc || desc.language !== 'typescript') continue;
        if (allDeps[desc.detection.manifestKey] !== undefined) {
          return desc;
        }
      }
    } catch {
      // malformed package.json — fall through to default
    }
  }

  // Default: NestJS is the primary framework this package was built for
  return frameworks['nestjs'];
}
