import { DynamicModule, Global, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { FlowMapperConfig } from '../dto/flow-mapper-config.dto';
import { FlowLogger } from '../logger/flow-logger';
import { FlowMapper } from './flow-mapper';

const LOGGER_CONTEXT = 'FlowMapperModule';

/**
 * NestJS module integration for FlowMapper.
 *
 * @example
 * // app.module.ts
 * @Module({
 *   imports: [
 *     FlowMapperModule.forRoot({ port: 4567, enableAI: true, apiKey: process.env.API_KEY }),
 *   ],
 * })
 * export class AppModule {}
 */
@Global()
@Module({})
export class FlowMapperModule implements OnModuleInit, OnModuleDestroy {
  private static userConfig: FlowMapperConfig = {};
  private instance: FlowMapper | null = null;

  static forRoot(config: FlowMapperConfig = {}): DynamicModule {
    FlowMapperModule.userConfig = config;
    return {
      module: FlowMapperModule,
      providers: [],
      exports: [],
    };
  }

  async onModuleInit(): Promise<void> {
    try {
      this.instance = await FlowMapper.init(null, FlowMapperModule.userConfig);
    } catch (err) {
      FlowLogger.error(LOGGER_CONTEXT, 'Failed to initialize FlowMapper', {
        error: (err as Error).message,
      });
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.instance?.shutdown();
  }
}
