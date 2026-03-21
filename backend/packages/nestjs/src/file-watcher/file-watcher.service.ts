import * as fs from 'fs';
import * as path from 'path';

import { FlowLogger } from '../logger/flow-logger';
import { SUPPORTED_EXTENSIONS, FILE_WATCHER_DEBOUNCE_MS } from '../constants';

const LOGGER_CONTEXT = 'FileWatcherService';

export class FileWatcherService {
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly sourceRoot: string,
    private readonly onRebuild: () => Promise<void>,
    private readonly debounceMs: number = FILE_WATCHER_DEBOUNCE_MS,
  ) {}

  start(): void {
    try {
      this.watcher = fs.watch(
        this.sourceRoot,
        { recursive: true },
        (_event: fs.WatchEventType, filename: string | Buffer | null) => {
          if (!filename) return;

          const name = filename instanceof Buffer ? filename.toString() : filename;
          const ext = path.extname(name);

          if (!SUPPORTED_EXTENSIONS.includes(ext)) return;

          FlowLogger.debug(LOGGER_CONTEXT, 'File change detected', { file: name });
          this.scheduleRebuild();
        },
      );

      this.watcher.on('error', (err: Error) => {
        FlowLogger.warn(LOGGER_CONTEXT, 'Watcher error — file-watch disabled', {
          error: err.message,
        });
        this.stop();
      });

      FlowLogger.info(LOGGER_CONTEXT, 'File watcher started', { sourceRoot: this.sourceRoot });
    } catch (err) {
      // fs.watch is not supported on all platforms/filesystems — degrade gracefully.
      FlowLogger.warn(LOGGER_CONTEXT, 'Failed to start file watcher — live-reload disabled', {
        error: (err as Error).message,
      });
    }
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.watcher?.close();
    this.watcher = null;
  }

  private scheduleRebuild(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      FlowLogger.info(LOGGER_CONTEXT, 'Triggering rebuild after file change');
      try {
        await this.onRebuild();
      } catch (err) {
        FlowLogger.error(LOGGER_CONTEXT, 'Rebuild after file change failed', {
          error: (err as Error).message,
        });
      }
    }, this.debounceMs);
  }
}
