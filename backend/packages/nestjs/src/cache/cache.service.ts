import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { FlowLogger } from '../logger/flow-logger';
import { CacheEntry, CacheIndex } from '../dto/flow-mapper-config.dto';
import { CacheException } from '../exceptions/flow-mapper.exceptions';
import { FLOW_CACHE_INDEX_FILE } from '../constants';

const LOGGER_CONTEXT = 'CacheService';

export class CacheService {
  private readonly cachePath: string;
  private readonly indexPath: string;
  private index: CacheIndex = {};

  constructor(cachePath: string) {
    this.cachePath = cachePath;
    this.indexPath = path.join(this.cachePath, FLOW_CACHE_INDEX_FILE);
    this.ensureCacheDir();
    this.loadIndex();
  }

  hashBody(rawBody: string): string {
    return crypto.createHash('sha256').update(rawBody).digest('hex');
  }

  get(nodeId: string, currentHash: string): string | undefined {
    const entry = this.index[nodeId];
    if (!entry) return undefined;

    if (entry.bodyHash !== currentHash) {
      FlowLogger.debug(LOGGER_CONTEXT, 'Cache miss: function body changed', { nodeId });
      return undefined;
    }

    FlowLogger.debug(LOGGER_CONTEXT, 'Cache hit', { nodeId });
    return entry.summary;
  }

  set(nodeId: string, bodyHash: string, summary: string): void {
    this.index[nodeId] = {
      bodyHash,
      summary,
      cachedAt: new Date().toISOString(),
    };
    this.persistIndex();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }
  }

  private loadIndex(): void {
    if (!fs.existsSync(this.indexPath)) {
      this.index = {};
      return;
    }

    try {
      const raw = fs.readFileSync(this.indexPath, 'utf8');
      this.index = JSON.parse(raw) as CacheIndex;
    } catch (err) {
      FlowLogger.warn(LOGGER_CONTEXT, 'Failed to load cache index, starting fresh', {
        error: (err as Error).message,
      });
      this.index = {};
    }
  }

  private persistIndex(): void {
    try {
      fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf8');
    } catch (err) {
      throw new CacheException('persist index', (err as Error).message);
    }
  }
}
