import { FlowMapConfig } from './dto/config.dto';
import { DEFAULT_SIDECAR_PORT } from './constants';

type NextConfig = Record<string, unknown>;

/**
 * Wraps your Next.js config to enable code-map.
 *
 * Enables the instrumentation hook (required for FlowMap.init() in instrumentation.ts)
 * and forwards the configured sidecar port via an env var.
 *
 * @example
 * // next.config.ts
 * import { withCodeMap } from '@code-map/nextjs';
 *
 * const nextConfig = {
 *   // ... your existing config
 * };
 *
 * export default withCodeMap(nextConfig);
 *
 * @example
 * // next.config.ts (with options)
 * export default withCodeMap(nextConfig, { port: 4567, enableAI: true });
 */
export function withCodeMap(nextConfig: NextConfig = {}, config: FlowMapConfig = {}): NextConfig {
  const port = config.port ?? DEFAULT_SIDECAR_PORT;

  return {
    ...nextConfig,
    experimental: {
      ...((nextConfig.experimental as Record<string, unknown>) ?? {}),
      instrumentationHook: true,
    },
    env: {
      ...((nextConfig.env as Record<string, string>) ?? {}),
      FLOW_MAP_PORT: String(port),
    },
  };
}
