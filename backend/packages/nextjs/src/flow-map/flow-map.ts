import * as path from 'path';

import { FlowLogger } from '../logger/logger';
import { FlowGraph, FlowMapConfig, ResolvedFlowMapConfig } from '../dto/config.dto';
import { FlowMapInitializationException, FlowMapConfigException } from '../exceptions/exceptions';
import { AstParserService } from '../ast/ast-parser.service';
import { CacheService } from '../cache/cache.service';
import { NanoAgentService } from '../nano-agent/nano-agent.service';
import { SidecarService } from '../sidecar/sidecar.service';
import { FlowMapService } from './flow-map.service';
import { AIProvider, DEFAULT_SIDECAR_PORT, FLOW_CACHE_DIR } from '../constants';
import envConfig from '../config/env-config';

const LOGGER_CONTEXT = 'FlowMap';

export class FlowMap {
  private static instance: FlowMap | null = null;

  private readonly service: FlowMapService;
  private readonly sidecar: SidecarService;

  private constructor(service: FlowMapService, sidecar: SidecarService) {
    this.service = service;
    this.sidecar = sidecar;
  }

  /**
   * Initializes the FlowMap engine. Spawns the sidecar visualization server
   * and performs the first AST scan. Idempotent — returns the existing instance
   * if called more than once.
   *
   * Call this from your Next.js `instrumentation.ts`:
   * ```ts
   * export async function register() {
   *   if (process.env.NEXT_RUNTIME === 'nodejs') {
   *     await FlowMap.init();
   *   }
   * }
   * ```
   *
   * @param userConfig - Optional configuration overrides.
   */
  static async init(userConfig: FlowMapConfig = {}): Promise<FlowMap> {
    if (FlowMap.instance) {
      FlowLogger.warn(LOGGER_CONTEXT, 'FlowMap.init() called more than once — returning existing instance');
      return FlowMap.instance;
    }

    const config = FlowMap.resolveConfig(userConfig);
    FlowMap.validateConfig(config);

    const astParser = new AstParserService();
    const cache = new CacheService(config.cachePath);
    const sidecar = new SidecarService();
    const nanoAgent = config.enableAI ? new NanoAgentService(config.apiKey, config.provider as AIProvider, config.model) : null;
    const service = new FlowMapService(config, astParser, cache, sidecar, nanoAgent);

    FlowLogger.info(LOGGER_CONTEXT, 'Initializing FlowMap', {
      port: config.port,
      enableAI: config.enableAI,
      sourceRoot: config.sourceRoot,
    });

    try {
      await sidecar.start(config.port);
      await service.buildAndServeGraph();
    } catch (err) {
      throw new FlowMapInitializationException((err as Error).message);
    }

    FlowMap.instance = new FlowMap(service, sidecar);
    return FlowMap.instance;
  }

  /** Triggers a fresh AST scan and updates the served graph data. */
  async rebuild(): Promise<FlowGraph> {
    return this.service.buildAndServeGraph();
  }

  /** Stops the sidecar server and resets the singleton. */
  async shutdown(): Promise<void> {
    await this.sidecar.stop();
    FlowMap.instance = null;
    FlowLogger.info(LOGGER_CONTEXT, 'FlowMap shut down');
  }

  private static resolveConfig(userConfig: FlowMapConfig): ResolvedFlowMapConfig {
    const portFromEnv = envConfig.port;
    return {
      port: userConfig.port ?? portFromEnv ?? DEFAULT_SIDECAR_PORT,
      enableAI: userConfig.enableAI ?? false,
      apiKey: userConfig.apiKey ?? envConfig.apiKey ?? '',
      provider: userConfig.provider ?? envConfig.provider ?? ('' as AIProvider),
      model: userConfig.model,
      cachePath: userConfig.cachePath ?? path.join(process.cwd(), FLOW_CACHE_DIR),
      sourceRoot: userConfig.sourceRoot ?? process.cwd(),
    };
  }

  private static validateConfig(config: ResolvedFlowMapConfig): void {
    if (config.port < 1 || config.port > 65535) {
      throw new FlowMapConfigException('port', `must be between 1 and 65535, got ${config.port}`);
    }

    if (config.enableAI && !config.apiKey) {
      throw new FlowMapInitializationException(
        'enableAI is true but no apiKey was provided. ' +
          'Set apiKey in config or the SUMMARIES_API_KEY environment variable.',
      );
    }

    if (config.enableAI && !config.provider) {
      throw new FlowMapInitializationException(
        'enableAI is true but no provider was specified. ' +
          'Set provider in config or the SUMMARIES_PROVIDER environment variable.',
      );
    }
  }
}
