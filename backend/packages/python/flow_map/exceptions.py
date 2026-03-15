class FlowMapInitializationError(RuntimeError):
    def __init__(self, message: str) -> None:
        super().__init__(f"[FlowMap] Initialization failed: {message}")


class FlowMapConfigError(ValueError):
    def __init__(self, field: str, reason: str) -> None:
        super().__init__(f'[FlowMap] Invalid configuration for "{field}": {reason}')


class AstParserError(RuntimeError):
    def __init__(self, file_path: str, reason: str) -> None:
        super().__init__(f'[AstParser] Failed to parse "{file_path}": {reason}')


class NanoAgentError(RuntimeError):
    def __init__(self, node_id: str, reason: str) -> None:
        super().__init__(f'[NanoAgent] Failed to summarize node "{node_id}": {reason}')


class CacheError(RuntimeError):
    def __init__(self, operation: str, reason: str) -> None:
        super().__init__(f"[Cache] Failed to {operation}: {reason}")


class SidecarError(RuntimeError):
    def __init__(self, port: int, reason: str) -> None:
        super().__init__(f"[Sidecar] Failed to start on port {port}: {reason}")
