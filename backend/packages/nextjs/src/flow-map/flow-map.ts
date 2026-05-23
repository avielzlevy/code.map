import * as path from 'path';

import { FlowLogger } from '../logger/logger';
import { FlowGraph, CodeMapConfig, ResolvedCodeMapConfig } from '../dto/config.dto';
import { CodeMapInitializationException, CodeMapConfigException } from '../exceptions/exceptions';
import { AstParserService } from '../ast/ast-parser.service';
import { CacheService } from '../cache/cache.service';
import { NanoAgentService } from '../nano-agent/nano-agent.service';
import { SidecarService } from '../sidecar/sidecar.service';
import { FlowMapService } from './flow-map.service';
import { AIProvider, DEFAULT_SIDECAR_PORT, FLOW_CACHE_DIR } from '../constants';
import envConfig from '../config/env-config';

const LOGGER_CONTEXT = 'CodeMap';

export class CodeMap {
  private static instance: CodeMap | null = null;

  private readonly service: FlowMapService;
  private readonly sidecar: SidecarService;

  private constructor(service: FlowMapService, sidecar: SidecarService) {
    this.service = service;
    this.sidecar = sidecar;
  }

  /**
   * Initializes the code.map engine. Spawns the sidecar visualization server
   * and performs the first AST scan. Idempotent — returns the existing instance
   * if called more than once.
   *
   * Call this from your Next.js `instrumentation.ts`:
   * ```ts
   * export async function register() {
   *   if (process.env.NEXT_RUNTIME === 'nodejs') {
   *     await CodeMap.init();
   *   }
   * }
   * ```
   *
   * @param userConfig - Optional configuration overrides.
   */
  static async init(userConfig: CodeMapConfig = {}): Promise<CodeMap> {
    if (CodeMap.instance) {
      FlowLogger.warn(LOGGER_CONTEXT, 'CodeMap.init() called more than once — returning existing instance');
      return CodeMap.instance;
    }

    const config = CodeMap.resolveConfig(userConfig);
    CodeMap.validateConfig(config);

    const astParser = new AstParserService();
    const cache = new CacheService(config.cachePath);
    const sidecar = new SidecarService();
    const nanoAgent = config.enableAI ? new NanoAgentService(config.apiKey, config.provider as AIProvider, config.model) : null;
    const service = new FlowMapService(config, astParser, cache, sidecar, nanoAgent);

    FlowLogger.info(LOGGER_CONTEXT, 'Initializing code.map', {
      port: config.port,
      enableAI: config.enableAI,
      sourceRoot: config.sourceRoot,
    });

    try {
      await sidecar.start(config.port);
      await service.buildAndServeGraph();
    } catch (err) {
      throw new CodeMapInitializationException((err as Error).message);
    }

    CodeMap.instance = new CodeMap(service, sidecar);
    return CodeMap.instance;
  }

  /** Triggers a fresh AST scan and updates the served graph data. */
  async rebuild(): Promise<FlowGraph> {
    return this.service.buildAndServeGraph();
  }

  /** Stops the sidecar server and resets the singleton. */
  async shutdown(): Promise<void> {
    await this.sidecar.stop();
    CodeMap.instance = null;
    FlowLogger.info(LOGGER_CONTEXT, 'code.map shut down');
  }

  private static resolveConfig(userConfig: CodeMapConfig): ResolvedCodeMapConfig {
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

  private static validateConfig(config: ResolvedCodeMapConfig): void {
    if (config.port < 1 || config.port > 65535) {
      throw new CodeMapConfigException('port', `must be between 1 and 65535, got ${config.port}`);
    }

    if (config.enableAI && !config.apiKey) {
      throw new CodeMapInitializationException(
        'enableAI is true but no apiKey was provided. ' +
          'Set apiKey in config or the SUMMARIES_API_KEY environment variable.',
      );
    }

    if (config.enableAI && !config.provider) {
      throw new CodeMapInitializationException(
        'enableAI is true but no provider was specified. ' +
          'Set provider in config or the SUMMARIES_PROVIDER environment variable.',
      );
    }
  }
}
