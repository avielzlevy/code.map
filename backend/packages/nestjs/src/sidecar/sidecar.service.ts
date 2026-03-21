import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';

import { FlowLogger } from '../logger/flow-logger';
import { FlowGraph, FrontendExecutionPath, ApiResponse } from '../dto/flow-mapper-config.dto';
import { SidecarException } from '../exceptions/flow-mapper.exceptions';
import { SIDECAR_API_PREFIX, SSE_HEARTBEAT_INTERVAL_MS } from '../constants';

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
      this.server = this.app.listen(port, () => {
        FlowLogger.info(LOGGER_CONTEXT, 'Sidecar server listening', {
          port,
          url: `http://localhost:${port}`,
        });
        FlowLogger.warn(
          LOGGER_CONTEXT,
          'SECURITY: The sidecar binds to all interfaces by default. ' +
          'Ensure port ' + port + ' is not reachable from outside localhost in shared or staging environments.',
        );
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

    this.serveStaticFrontend();
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
