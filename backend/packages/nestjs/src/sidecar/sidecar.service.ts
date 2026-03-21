import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';

import { FlowLogger } from '../logger/flow-logger';
import { FlowGraph, FrontendExecutionPath, ApiResponse } from '../dto/flow-mapper-config.dto';
import { SidecarException } from '../exceptions/flow-mapper.exceptions';
import { SIDECAR_API_PREFIX } from '../constants';

const LOGGER_CONTEXT = 'SidecarService';

export class SidecarService {
  private readonly app: Application;
  private server: http.Server | null = null;
  private currentGraph: FlowGraph | null = null;
  private currentPaths: FrontendExecutionPath[] = [];
  private aiEnriching = false;

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
  }

  setAiEnriching(value: boolean): void {
    this.aiEnriching = value;
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
        resolve();
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        reject(new SidecarException(port, err.message));
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private registerRoutes(): void {
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
