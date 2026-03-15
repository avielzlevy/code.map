import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { CacheService } from '../cache.service';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'flow-cache-test-'));
}

describe('CacheService', () => {
  let tempDir: string;
  let cache: CacheService;

  beforeEach(() => {
    tempDir = makeTempDir();
    cache = new CacheService(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('hashBody()', () => {
    it('returns a consistent SHA-256 hex string for the same input', () => {
      const h1 = cache.hashBody('function foo() {}');
      const h2 = cache.hashBody('function foo() {}');

      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    });

    it('returns different hashes for different bodies', () => {
      const h1 = cache.hashBody('function foo() {}');
      const h2 = cache.hashBody('function bar() {}');

      expect(h1).not.toBe(h2);
    });
  });

  describe('get() / set()', () => {
    const nodeId = 'src/user.service.ts:UserService#create:42';
    const body = 'async create() { return db.save(user); }';

    it('returns undefined for an unknown node', () => {
      expect(cache.get(nodeId, 'any-hash')).toBeUndefined();
    });

    it('returns the summary after a set()', () => {
      const hash = cache.hashBody(body);
      cache.set(nodeId, hash, 'Persists user record to database');

      expect(cache.get(nodeId, hash)).toBe('Persists user record to database');
    });

    it('returns undefined when the hash does not match (code changed)', () => {
      const hash = cache.hashBody(body);
      cache.set(nodeId, hash, 'Old summary');

      const staleHash = cache.hashBody('async create() { return something.else(); }');
      expect(cache.get(nodeId, staleHash)).toBeUndefined();
    });
  });

  describe('persistence', () => {
    it('loads previously written entries on construction', () => {
      const nodeId = 'src/foo.ts:Foo#bar:1';
      const hash = cache.hashBody('bar body');
      cache.set(nodeId, hash, 'Cached summary');

      // Recreate from same directory — must read the persisted index
      const cache2 = new CacheService(tempDir);
      expect(cache2.get(nodeId, hash)).toBe('Cached summary');
    });

    it('starts fresh when the index file is corrupt', () => {
      fs.writeFileSync(path.join(tempDir, 'index.json'), '{invalid json', 'utf8');
      expect(() => new CacheService(tempDir)).not.toThrow();
    });
  });
});
