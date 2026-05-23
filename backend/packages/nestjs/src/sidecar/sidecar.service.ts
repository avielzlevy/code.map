import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { FlowLogger } from '../logger/flow-logger';
import {
  FlowGraph,
  FrontendExecutionPath,
  ApiResponse,
  GuideArtifact,
  GuideAuthorInput,
  GuideAuthorResult,
} from '../dto/code-map-config.dto';
import { SidecarException, GuideException } from '../exceptions/code-map.exceptions';
import { SIDECAR_API_PREFIX, SSE_HEARTBEAT_INTERVAL_MS } from '../constants';
import { GuideService } from '../guide/guide.service';

const LOGGER_CONTEXT = 'SidecarService';

type SseEventType = 'status' | 'paths-updated' | 'rebuild-start';

export class SidecarService {
  private readonly app: Application;
  private server: http.Server | null = null;
  private currentGraph: FlowGraph | null = null;
  private currentPaths: FrontendExecutionPath[] = [];
  private aiEnriching = false;

  /** Active SSE response objects — one per connected browser tab. */
  private readonly sseClients = new Set<Response>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private readonly guideService = new GuideService();

  constructor() {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.registerRoutes();
  }

  updateGraph(graph: FlowGraph): void {
    this.currentGraph = graph;
  }

  updatePaths(paths: FrontendExecutionPath[]): void {
    this.currentPaths = paths;
    this.broadcast('paths-updated', paths);
  }

  setAiEnriching(value: boolean): void {
    this.aiEnriching = value;
    this.broadcast('status', { aiEnriching: value });
  }

  /** Notify clients that a file-change rebuild is starting. */
  broadcastRebuildStart(): void {
    this.broadcast('rebuild-start', { reason: 'file-change' });
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, '127.0.0.1', () => {
        FlowLogger.info(LOGGER_CONTEXT, 'Sidecar server listening', {
          port,
          url: `http://localhost:${port}`,
        });
        this.startHeartbeat();
        resolve();
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        reject(new SidecarException(port, err.message));
      });
    });
  }

  async stop(): Promise<void> {
    this.stopHeartbeat();
    this.sseClients.forEach((res) => res.end());
    this.sseClients.clear();

    if (!this.server) return;
    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Private — SSE helpers
  // ---------------------------------------------------------------------------

  private broadcast(event: SseEventType, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const comment = ': ping\n\n';
      for (const client of this.sseClients) {
        try {
          client.write(comment);
        } catch {
          this.sseClients.delete(client);
        }
      }
    }, SSE_HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private — routes
  // ---------------------------------------------------------------------------

  private registerRoutes(): void {
    this.app.get(`${SIDECAR_API_PREFIX}/events`, (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
      res.flushHeaders();

      this.sseClients.add(res);
      FlowLogger.debug(LOGGER_CONTEXT, 'SSE client connected', { total: this.sseClients.size });

      // Immediately push current state so the client is in sync.
      res.write(`event: status\ndata: ${JSON.stringify({ aiEnriching: this.aiEnriching })}\n\n`);
      if (this.currentPaths.length > 0) {
        res.write(`event: paths-updated\ndata: ${JSON.stringify(this.currentPaths)}\n\n`);
      }

      req.on('close', () => {
        this.sseClients.delete(res);
        FlowLogger.debug(LOGGER_CONTEXT, 'SSE client disconnected', { total: this.sseClients.size });
      });
    });

    this.app.get(`${SIDECAR_API_PREFIX}/paths`, (_req: Request, res: Response) => {
      const response: ApiResponse<FrontendExecutionPath[]> = {
        status: 'success',
        data: this.currentPaths,
      };
      res.json(response);
    });

    this.app.get(`${SIDECAR_API_PREFIX}/graph`, (_req: Request, res: Response) => {
      if (!this.currentGraph) {
        const response: ApiResponse<null> = { status: 'error', data: null };
        res.status(503).json(response);
        return;
      }

      // Strip rawBody before serving — function source code must not be exposed over HTTP
      const sanitizedGraph = {
        ...this.currentGraph,
        nodes: this.currentGraph.nodes.map(({ rawBody: _rawBody, ...safeNode }) => safeNode),
      };
      const response: ApiResponse<typeof sanitizedGraph> = { status: 'success', data: sanitizedGraph };
      res.json(response);
    });

    this.app.get(`${SIDECAR_API_PREFIX}/health`, (_req: Request, res: Response) => {
      const response: ApiResponse<{ alive: boolean }> = {
        status: 'success',
        data: { alive: true },
      };
      res.json(response);
    });

    this.app.get(`${SIDECAR_API_PREFIX}/status`, (_req: Request, res: Response) => {
      const response: ApiResponse<{ aiEnriching: boolean }> = {
        status: 'success',
        data: { aiEnriching: this.aiEnriching },
      };
      res.json(response);
    });

    this.app.get(`${SIDECAR_API_PREFIX}/git-info`, (_req: Request, res: Response) => {
      const info = this.resolveGitInfo();
      const response: ApiResponse<typeof info> = { status: 'success', data: info };
      res.json(response);
    });

    this.app.get(`${SIDECAR_API_PREFIX}/guide/saved`, (_req: Request, res: Response) => {
      const { root } = this.resolveGitInfo();
      const response: ApiResponse<string[]> = {
        status: 'success',
        data: this.guideService.listSaved(root),
      };
      res.json(response);
    });

    this.app.get(`${SIDECAR_API_PREFIX}/guide/saved/:slug`, (req: Request, res: Response) => {
      const { root } = this.resolveGitInfo();
      try {
        const guide = this.guideService.loadSaved(root, req.params.slug);
        const response: ApiResponse<GuideArtifact> = { status: 'success', data: guide };
        res.json(response);
      } catch (err) {
        if (err instanceof GuideException) {
          FlowLogger.warn(LOGGER_CONTEXT, 'Saved guide load failed', { error: err.message });
          const response: ApiResponse<null> = { status: 'error', data: null };
          res.status(404).json(response);
          return;
        }
        throw err;
      }
    });

    // Author a guide from SEMANTIC steps. The server resolves each step to a real
    // graph node, validates, and writes the file — so the skill never builds ids.
    this.app.post(`${SIDECAR_API_PREFIX}/guide`, (req: Request, res: Response) => {
      if (!this.currentGraph) {
        res.status(503).json({ status: 'error', data: null } as ApiResponse<null>);
        return;
      }
      const body = req.body as Partial<GuideAuthorInput>;
      if (!body || typeof body.slug !== 'string' || !Array.isArray(body.steps)) {
        res.status(400).json({ status: 'error', data: null } as ApiResponse<null>);
        return;
      }
      const { root } = this.resolveGitInfo();
      try {
        const { artifact, unresolved } = this.guideService.author(
          this.currentGraph,
          root,
          body as GuideAuthorInput,
        );
        const result: GuideAuthorResult = {
          slug: body.slug,
          url: artifact.steps.length > 0 ? `/app?guide=${body.slug}` : '',
          resolved: artifact.steps.length,
          total: body.steps.length,
          unresolved,
        };
        // Nothing resolved — don't write an empty guide; return the reasons so the LLM can fix.
        if (artifact.steps.length === 0) {
          res.status(422).json({ status: 'error', data: result } as ApiResponse<GuideAuthorResult>);
          return;
        }
        this.guideService.save(root, body.slug, artifact);
        res.json({ status: 'success', data: result } as ApiResponse<GuideAuthorResult>);
      } catch (err) {
        if (err instanceof GuideException) {
          FlowLogger.warn(LOGGER_CONTEXT, 'Guide author failed', { error: err.message });
          res.status(400).json({ status: 'error', data: null } as ApiResponse<null>);
          return;
        }
        throw err;
      }
    });

    this.serveStaticFrontend();
  }

  private resolveGitInfo(): { githubBaseUrl: string | null; sha: string | null; root: string } {
    const cwd = process.cwd();
    // The git repo root — NOT process.cwd(). git reports diff paths relative to the
    // repo top-level, so node-path relativization must use the same base or nothing
    // maps when the server is started from a subdirectory.
    let root = cwd;
    try {
      root =
        execSync('git rev-parse --show-toplevel', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd,
        }).trim() || cwd;
    } catch {
      // not a git repo — fall back to cwd
    }
    try {
      const rawRemote = execSync('git remote get-url origin', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: root,
      }).trim();
      const sha = execSync('git rev-parse HEAD', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: root,
      }).trim();

      // SSH:   git@github.com:owner/repo.git
      // HTTPS: https://github.com/owner/repo[.git]
      const sshMatch = rawRemote.match(/git@github\.com:([^/]+\/[^.]+?)(?:\.git)?$/);
      const httpsMatch = rawRemote.match(/https?:\/\/github\.com\/([^/]+\/[^/.]+?)(?:\.git)?$/);
      const slug = sshMatch?.[1] ?? httpsMatch?.[1] ?? null;
      const githubBaseUrl = slug ? `https://github.com/${slug}` : null;

      return { githubBaseUrl, sha, root };
    } catch {
      return { githubBaseUrl: null, sha: null, root };
    }
  }

  private serveStaticFrontend(): void {
    // At runtime __dirname = <repo>/backend/packages/nestjs/dist/sidecar/
    // Five levels up reaches the repo root, then into frontend/out
    const frontendOutPath = path.resolve(__dirname, '../../../../../frontend/out');

    if (fs.existsSync(frontendOutPath)) {
      this.app.use(express.static(frontendOutPath, { extensions: ['html'] }));
      this.app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(frontendOutPath, 'index.html'));
      });
      FlowLogger.info(LOGGER_CONTEXT, 'Serving compiled frontend', { path: frontendOutPath });
    } else {
      this.app.get('/', (_req: Request, res: Response) => {
        res.status(200).send(
          '<p>FlowMap UI not found. Run <code>npm run build</code> in the frontend package first.</p>',
        );
      });
      FlowLogger.warn(LOGGER_CONTEXT, 'Frontend build not found; serving placeholder', {
        expectedPath: frontendOutPath,
      });
    }
  }
}
