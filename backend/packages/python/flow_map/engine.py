from __future__ import annotations

import asyncio
import dataclasses
import os
from typing import Any, Optional

from .ast_parser import AstParserService, FlowGraph
from .cache import CacheService
from .config import env_config
from .constants import DEFAULT_SIDECAR_PORT, FLOW_CACHE_DIR, NANO_AGENT_BATCH_SIZE
from .exceptions import FlowMapConfigError, FlowMapInitializationError
from .file_watcher import FileWatcherService
from .logger import FlowLogger
from .nano_agent import NanoAgentService
from .sidecar import SidecarService

LOGGER_CONTEXT = "FlowMap"


class FlowMap:
    _instance: Optional[FlowMap] = None

    def __init__(
        self,
        ast_parser: AstParserService,
        cache: CacheService,
        sidecar: SidecarService,
        nano_agent: Optional[NanoAgentService],
        file_watcher: FileWatcherService,
        config: dict[str, Any],
    ) -> None:
        self._ast_parser = ast_parser
        self._cache = cache
        self._sidecar = sidecar
        self._nano_agent = nano_agent
        self._file_watcher = file_watcher
        self._config = config

    @classmethod
    async def bind(cls, app: Any, config: Optional[dict[str, Any]] = None) -> FlowMap:
        """
        Initializes the FlowMap engine. Spawns the sidecar visualization server
        and performs the first AST scan. Idempotent — returns the existing instance
        if called more than once.

        :param app: The FastAPI application instance.
        :param config: Optional configuration dict. Accepted keys:
            - port (int): Sidecar server port. Default: 4567.
            - enable_ai (bool): Enable AI summaries. Default: False.
            - api_key (str): LLM API key. Required when enable_ai is True.
            - cache_path (str): Path to cache directory.
            - source_root (str): Directory to scan for source files.
        """
        if cls._instance is not None:
            FlowLogger.warn(
                LOGGER_CONTEXT,
                "FlowMap.bind() called more than once — returning existing instance",
            )
            return cls._instance

        resolved = cls._resolve_config(config or {})
        cls._validate_config(resolved)

        ast_parser = AstParserService()
        cache = CacheService(resolved["cache_path"])
        sidecar = SidecarService()
        nano_agent = NanoAgentService(resolved["api_key"], resolved["provider"], resolved["model"]) if resolved["enable_ai"] else None

        FlowLogger.info(
            LOGGER_CONTEXT,
            "Initializing FlowMap",
            {"port": resolved["port"], "enable_ai": resolved["enable_ai"]},
        )

        async def _rebuild() -> None:
            sidecar.broadcast_rebuild_start()
            await instance._build_and_serve_graph()

        file_watcher = FileWatcherService(resolved["source_root"], _rebuild)

        try:
            sidecar.start(resolved["port"])
            instance = cls(ast_parser, cache, sidecar, nano_agent, file_watcher, resolved)
            await instance._build_and_serve_graph()
        except Exception as err:
            raise FlowMapInitializationError(str(err))

        loop = asyncio.get_event_loop()
        file_watcher.start(loop)

        cls._instance = instance
        return instance

    async def rebuild(self) -> FlowGraph:
        """Triggers a fresh AST scan and updates the served graph data."""
        return await self._build_and_serve_graph()

    def shutdown(self) -> None:
        """Stops the file watcher, sidecar server, and resets the singleton."""
        self._file_watcher.stop()
        self._sidecar.stop()
        FlowMap._instance = None
        FlowLogger.info(LOGGER_CONTEXT, "FlowMap shut down")

    async def _build_and_serve_graph(self) -> FlowGraph:
        graph = self._ast_parser.parse(self._config["source_root"])

        # Serve immediately without AI so the frontend is never blocked
        paths = self._build_execution_paths(graph)
        self._sidecar.update_graph(self._graph_to_dict(graph))
        self._sidecar.update_paths(paths)
        FlowLogger.info(
            LOGGER_CONTEXT,
            "Graph built and served",
            {"nodes": len(graph.nodes), "edges": len(graph.edges), "paths": len(paths)},
        )

        if self._config["enable_ai"] and self._nano_agent:
            asyncio.ensure_future(self._enrich_in_background(graph))

        return graph

    async def _enrich_in_background(self, graph: FlowGraph) -> None:
        self._sidecar.set_ai_enriching(True)
        try:
            await self._enrich_with_ai_summaries(graph)
            enriched_paths = self._build_execution_paths(graph)
            self._sidecar.update_graph(self._graph_to_dict(graph))
            self._sidecar.update_paths(enriched_paths)
        except Exception as err:
            FlowLogger.error(LOGGER_CONTEXT, "Background AI enrichment failed", {"error": str(err)})
        finally:
            self._sidecar.set_ai_enriching(False)

    def _build_execution_paths(self, graph: FlowGraph) -> list[dict]:
        node_map = {n.id: n for n in graph.nodes}
        adjacency: dict[str, list[str]] = {}
        for edge in graph.edges:
            adjacency.setdefault(edge.from_id, []).append(edge.to_id)

        controllers = [n for n in graph.nodes if n.type == "controller"]

        if not controllers:
            return [self._fallback_single_path(graph)]

        paths = []
        for controller in controllers:
            visited = self._bfs_reachable(controller.id, adjacency)
            path_nodes = [node_map[nid] for nid in visited if nid in node_map]
            path_edges = [
                {"id": f"{e.from_id}→{e.to_id}", "source": e.from_id, "target": e.to_id}
                for e in graph.edges
                if e.from_id in visited and e.to_id in visited
            ]
            paths.append({
                "endpoint": controller.route_path or self._derive_endpoint(controller.method_name),
                "method": controller.http_method or "GET",
                "nodes": [self._to_frontend_node(n) for n in path_nodes],
                "edges": path_edges,
            })
        return paths

    def _bfs_reachable(self, start_id: str, adjacency: dict[str, list[str]]) -> set[str]:
        visited: set[str] = set()
        queue = [start_id]
        while queue:
            nid = queue.pop(0)
            if nid in visited:
                continue
            visited.add(nid)
            queue.extend(adjacency.get(nid, []))
        return visited

    def _derive_endpoint(self, method_name: str) -> str:
        import re
        slug = re.sub(r"([A-Z])", r"-\1", method_name).lstrip("-").lower()
        return f"/{slug}"

    def _to_frontend_node(self, node) -> dict:
        return {
            "id": node.id,
            "type": "enhanced" if node.custom_tag else "standard",
            "funcName": node.method_name,
            "fileName": node.file_path,
            "line": node.line_number,
            "intentTag": node.custom_tag,
            "docstring": node.docstring,
            "aiSummary": node.ai_summary,
        }

    def _fallback_single_path(self, graph: FlowGraph) -> dict:
        return {
            "endpoint": "/*",
            "method": "ALL",
            "nodes": [self._to_frontend_node(n) for n in graph.nodes],
            "edges": [
                {"id": f"{e.from_id}→{e.to_id}", "source": e.from_id, "target": e.to_id}
                for e in graph.edges
            ],
        }

    async def _enrich_with_ai_summaries(self, graph: FlowGraph) -> None:
        # Deduplicate: nodes sharing the same body hash need only one API call
        hash_to_nodes: dict[str, list] = {}
        to_fetch: list = []

        for node in graph.nodes:
            body_hash = self._cache.hash_body(node.raw_body)
            cached = self._cache.get(node.id, body_hash)
            if cached:
                node.ai_summary = cached
                continue
            if body_hash in hash_to_nodes:
                hash_to_nodes[body_hash].append(node)
            else:
                hash_to_nodes[body_hash] = [node]
                to_fetch.append(node)

        FlowLogger.info(
            LOGGER_CONTEXT,
            f"Enriching {len(to_fetch)} unique nodes with AI summaries ({len(graph.nodes)} total)",
        )

        attempted = 0
        failed = 0

        async def fetch_one(node: Any) -> None:
            nonlocal attempted, failed
            body_hash = self._cache.hash_body(node.raw_body)
            attempted += 1
            try:
                summary = await self._nano_agent.summarize(node)  # type: ignore[union-attr]
                for n in hash_to_nodes.get(body_hash, [node]):
                    n.ai_summary = summary
                    self._cache.set(n.id, body_hash, summary)
            except Exception as err:
                failed += 1
                FlowLogger.warn(
                    LOGGER_CONTEXT,
                    "AI summary failed for node, skipping",
                    {"node_id": node.id, "error": str(err)},
                )

        for i in range(0, len(to_fetch), NANO_AGENT_BATCH_SIZE):
            batch = to_fetch[i : i + NANO_AGENT_BATCH_SIZE]
            await asyncio.gather(*[fetch_one(n) for n in batch])

        if attempted > 0 and failed == attempted:
            FlowLogger.error(
                LOGGER_CONTEXT,
                "All AI summary requests failed — check your provider, model, and API key",
                {"attempted": attempted, "failed": failed},
            )

    def _graph_to_dict(self, graph: FlowGraph) -> dict[str, Any]:
        return {
            "nodes": [dataclasses.asdict(n) for n in graph.nodes],
            "edges": [
                {"from": e.from_id, "to": e.to_id} for e in graph.edges
            ],
            "generatedAt": graph.generated_at,
        }

    @staticmethod
    def _resolve_config(user_config: dict[str, Any]) -> dict[str, Any]:
        return {
            "port": user_config.get("port", DEFAULT_SIDECAR_PORT),
            "enable_ai": user_config.get("enable_ai", False),
            "api_key": user_config.get("api_key") or env_config.api_key or "",
            "provider": user_config.get("provider") or env_config.provider or "",
            "model": user_config.get("model") or None,
            "cache_path": user_config.get("cache_path")
            or os.path.join(os.getcwd(), FLOW_CACHE_DIR),
            "source_root": user_config.get("source_root") or os.getcwd(),
        }

    @staticmethod
    def _validate_config(config: dict[str, Any]) -> None:
        port = config["port"]
        if not (1 <= port <= 65535):
            raise FlowMapConfigError("port", f"must be between 1 and 65535, got {port}")

        if config["enable_ai"] and not config["api_key"]:
            raise FlowMapInitializationError(
                "enable_ai is True but no api_key was provided. "
                "Set api_key in config or the SUMMARIES_API_KEY environment variable."
            )

        if config["enable_ai"] and not config["provider"]:
            raise FlowMapInitializationError(
                "enable_ai is True but no provider was specified. "
                "Set provider in config or the SUMMARIES_PROVIDER environment variable."
            )
