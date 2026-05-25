import { DynamicModule, Global, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { CodeMapConfig, CodeMap, FlowLogger } from '@code-map/node';

const LOGGER_CONTEXT = 'CodeMapModule';

/**
 * NestJS module integration for CodeMap.
 *
 * @example
 * // app.module.ts
 * @Module({
 *   imports: [
 *     CodeMapModule.forRoot({ port: 4567, enableAI: true, apiKey: process.env.API_KEY }),
 *   ],
 * })
 * export class AppModule {}
 */
@Global()
@Module({})
export class CodeMapModule implements OnModuleInit, OnModuleDestroy {
  private static userConfig: CodeMapConfig = {};
  private instance: CodeMap | null = null;

  static forRoot(config: CodeMapConfig = {}): DynamicModule {
    CodeMapModule.userConfig = config;
    return {
      module: CodeMapModule,
      providers: [],
      exports: [],
    };
  }

  async onModuleInit(): Promise<void> {
    try {
      this.instance = await CodeMap.init(null, CodeMapModule.userConfig);
    } catch (err) {
      FlowLogger.error(LOGGER_CONTEXT, 'Failed to initialize CodeMap', {
        error: (err as Error).message,
      });
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.instance?.shutdown();
  }
}
