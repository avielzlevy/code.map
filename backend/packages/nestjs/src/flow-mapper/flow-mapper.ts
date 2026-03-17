import * as path from 'path';

import { FlowLogger } from '../logger/flow-logger';
import { FlowGraph, FlowMapperConfig, ResolvedFlowMapperConfig } from '../dto/flow-mapper-config.dto';
import {
  FlowMapperInitializationException,
  FlowMapperConfigException,
} from '../exceptions/flow-mapper.exceptions';
import { AstParserService } from '../ast/ast-parser.service';
import { CacheService } from '../cache/cache.service';
import { NanoAgentService } from '../nano-agent/nano-agent.service';
import { SidecarService } from '../sidecar/sidecar.service';
import { FlowMapperService } from './flow-mapper.service';
import { AIProvider, DEFAULT_SIDECAR_PORT, FLOW_CACHE_DIR } from '../constants';
import envConfig from '../config/env-config';

const LOGGER_CONTEXT = 'FlowMapper';

export class FlowMapper {
  private static instance: FlowMapper | null = null;

  private readonly service: FlowMapperService;
  private readonly sidecar: SidecarService;

  private constructor(service: FlowMapperService, sidecar: SidecarService) {
    this.service = service;
    this.sidecar = sidecar;
  }

  /**
   * Initializes the FlowMapper engine. Spawns the sidecar visualization server
   * and performs the first AST scan. Idempotent — returns the existing instance
   * if called more than once.
   *
   * @param app - The NestJS application instance (unused at runtime, accepted for parity with NestJS lifecycle).
   * @param userConfig - Optional configuration overrides.
   */
  static async init(app: unknown, userConfig: FlowMapperConfig = {}): Promise<FlowMapper> {
    if (FlowMapper.instance) {
      FlowLogger.warn(LOGGER_CONTEXT, 'FlowMapper.init() called more than once — returning existing instance');
      return FlowMapper.instance;
    }

    const config = FlowMapper.resolveConfig(userConfig);
    FlowMapper.validateConfig(config);

    const astParser = new AstParserService();
    const cache = new CacheService(config.cachePath);
    const sidecar = new SidecarService();
    const nanoAgent = config.enableAI ? new NanoAgentService(config.apiKey, config.provider as AIProvider) : null;
    const service = new FlowMapperService(config, astParser, cache, sidecar, nanoAgent);

    FlowLogger.info(LOGGER_CONTEXT, 'Initializing FlowMapper', {
      port: config.port,
      enableAI: config.enableAI,
      sourceRoot: config.sourceRoot,
    });

    try {
      await sidecar.start(config.port);
      await service.buildAndServeGraph();
    } catch (err) {
      throw new FlowMapperInitializationException((err as Error).message);
    }

    FlowMapper.instance = new FlowMapper(service, sidecar);
    return FlowMapper.instance;
  }

  /** Triggers a fresh AST scan and updates the served graph data. */
  async rebuild(): Promise<FlowGraph> {
    return this.service.buildAndServeGraph();
  }

  /** Stops the sidecar server and resets the singleton. */
  async shutdown(): Promise<void> {
    await this.sidecar.stop();
    FlowMapper.instance = null;
    FlowLogger.info(LOGGER_CONTEXT, 'FlowMapper shut down');
  }

  private static resolveConfig(userConfig: FlowMapperConfig): ResolvedFlowMapperConfig {
    return {
      port: userConfig.port ?? DEFAULT_SIDECAR_PORT,
      enableAI: userConfig.enableAI ?? false,
      apiKey: userConfig.apiKey ?? envConfig.apiKey ?? '',
      provider: userConfig.provider ?? envConfig.provider ?? ('' as AIProvider),
      cachePath: userConfig.cachePath ?? path.join(process.cwd(), FLOW_CACHE_DIR),
      sourceRoot: userConfig.sourceRoot ?? process.cwd(),
    };
  }

  private static validateConfig(config: ResolvedFlowMapperConfig): void {
    if (config.port < 1 || config.port > 65535) {
      throw new FlowMapperConfigException('port', `must be between 1 and 65535, got ${config.port}`);
    }

    if (config.enableAI && !config.apiKey) {
      throw new FlowMapperInitializationException(
        'enableAI is true but no apiKey was provided. ' +
          'Set apiKey in config or the SUMMARIES_API_KEY environment variable.',
      );
    }

    if (config.enableAI && !config.provider) {
      throw new FlowMapperInitializationException(
        'enableAI is true but no provider was specified. ' +
          'Set provider in config or the SUMMARIES_PROVIDER environment variable.',
      );
    }
  }
}
