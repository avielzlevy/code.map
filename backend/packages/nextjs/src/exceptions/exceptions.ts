export class FlowMapInitializationException extends Error {
  constructor(message: string) {
    super(`[FlowMap] Initialization failed: ${message}`);
    this.name = 'FlowMapInitializationException';
  }
}

export class FlowMapConfigException extends Error {
  constructor(field: string, reason: string) {
    super(`[FlowMap] Invalid configuration for "${field}": ${reason}`);
    this.name = 'FlowMapConfigException';
  }
}

export class AstParserException extends Error {
  constructor(filePath: string, reason: string) {
    super(`[AstParser] Failed to parse "${filePath}": ${reason}`);
    this.name = 'AstParserException';
  }
}

export class NanoAgentException extends Error {
  constructor(nodeId: string, reason: string) {
    super(`[NanoAgent] Failed to summarize node "${nodeId}": ${reason}`);
    this.name = 'NanoAgentException';
  }
}

export class CacheException extends Error {
  constructor(operation: string, reason: string) {
    super(`[Cache] Failed to ${operation}: ${reason}`);
    this.name = 'CacheException';
  }
}

export class SidecarException extends Error {
  constructor(port: number, reason: string) {
    super(`[Sidecar] Failed to start on port ${port}: ${reason}`);
    this.name = 'SidecarException';
  }
}
