import ast
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Union

from .constants import FASTAPI_ROUTE_DECORATORS, EXCLUDED_DIRS, SUPPORTED_EXTENSIONS
from .exceptions import AstParserError
from .logger import FlowLogger

LOGGER_CONTEXT = "AstParserService"

AnyFunctionDef = Union[ast.FunctionDef, ast.AsyncFunctionDef]


@dataclass
class FlowNode:
    id: str
    label: str
    method_name: str
    type: str  # 'controller' | 'service' | 'utility' | 'unknown'
    file_path: str
    line_number: int
    docstring: Optional[str]
    raw_body: str
    ai_summary: Optional[str] = None
    custom_tag: Optional[str] = None
    http_method: Optional[str] = None
    route_path: Optional[str] = None


@dataclass
class FlowEdge:
    from_id: str
    to_id: str


@dataclass
class FlowGraph:
    nodes: list[FlowNode] = field(default_factory=list)
    edges: list[FlowEdge] = field(default_factory=list)
    generated_at: str = ""


HTTP_METHOD_MAP: dict[str, str] = {
    "get": "GET", "post": "POST", "put": "PUT", "delete": "DELETE",
    "patch": "PATCH", "options": "OPTIONS", "head": "HEAD",
    "route": "GET", "api_route": "GET",
}


@dataclass
class _ParsedMethod:
    class_name: str
    method_name: str
    class_decorators: list[str]
    method_decorators: list[str]
    flow_step_tag: Optional[str]
    http_method: Optional[str]
    route_path: Optional[str]
    docstring: Optional[str]
    raw_body: str
    file_path: str
    line_number: int
    calls: list[str]
    node_type: str


class AstParserService:
    def parse(self, source_root: str) -> FlowGraph:
        FlowLogger.info(LOGGER_CONTEXT, "Starting AST parse", {"source_root": source_root})

        files = self._collect_source_files(source_root)
        FlowLogger.info(LOGGER_CONTEXT, f"Found {len(files)} source files to analyze")

        all_methods: list[_ParsedMethod] = []
        for file_path in files:
            try:
                methods = self._parse_file(file_path)
                all_methods.extend(methods)
            except Exception as err:
                FlowLogger.warn(
                    LOGGER_CONTEXT,
                    "Skipping file due to parse error",
                    {"file": file_path, "error": str(err)},
                )

        graph = self._build_graph(all_methods)
        FlowLogger.info(
            LOGGER_CONTEXT,
            "AST parse complete",
            {"nodes": len(graph.nodes), "edges": len(graph.edges)},
        )
        return graph

    def _collect_source_files(self, root: str) -> list[str]:
        results: list[str] = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
            for filename in filenames:
                if os.path.splitext(filename)[1] in SUPPORTED_EXTENSIONS:
                    results.append(os.path.join(dirpath, filename))
        return results

    def _parse_file(self, file_path: str) -> list[_ParsedMethod]:
        with open(file_path, "r", encoding="utf-8") as f:
            source = f.read()

        try:
            tree = ast.parse(source, filename=file_path)
        except SyntaxError as err:
            raise AstParserError(file_path, str(err))

        methods: list[_ParsedMethod] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                methods.extend(self._parse_class(node, file_path, source))
        return methods

    def _parse_class(
        self, class_node: ast.ClassDef, file_path: str, source: str
    ) -> list[_ParsedMethod]:
        class_decorators = self._extract_decorator_names(class_node)
        node_type = self._classify_node_type(class_decorators)
        methods: list[_ParsedMethod] = []

        for item in class_node.body:
            if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue

            method_decorators = self._extract_decorator_names(item)
            flow_step_tag = self._extract_flow_step_tag(item)
            http_method, route_path = self._extract_http_decorator(item)
            docstring = ast.get_docstring(item)
            raw_body = self._extract_raw_body(item, source)
            calls = self._extract_calls(item)

            methods.append(
                _ParsedMethod(
                    class_name=class_node.name,
                    method_name=item.name,
                    class_decorators=class_decorators,
                    method_decorators=method_decorators,
                    flow_step_tag=flow_step_tag,
                    http_method=http_method,
                    route_path=route_path,
                    docstring=docstring,
                    raw_body=raw_body,
                    file_path=file_path,
                    line_number=item.lineno,
                    calls=calls,
                    node_type=node_type,
                )
            )

        return methods

    def _extract_decorator_names(self, node: ast.AST) -> list[str]:
        names: list[str] = []
        for d in getattr(node, "decorator_list", []):
            if isinstance(d, ast.Name):
                names.append(d.id)
            elif isinstance(d, ast.Attribute):
                names.append(d.attr)
            elif isinstance(d, ast.Call):
                if isinstance(d.func, ast.Name):
                    names.append(d.func.id)
                elif isinstance(d.func, ast.Attribute):
                    names.append(d.func.attr)
        return names

    def _extract_flow_step_tag(self, method: AnyFunctionDef) -> Optional[str]:
        for d in method.decorator_list:
            if not isinstance(d, ast.Call):
                continue
            func = d.func
            name = (
                func.id
                if isinstance(func, ast.Name)
                else (func.attr if isinstance(func, ast.Attribute) else "")
            )
            if name != "flow_step":
                continue
            if not d.args:
                continue
            arg = d.args[0]
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                return arg.value
        return None

    def _extract_http_decorator(
        self, method: AnyFunctionDef
    ) -> tuple[Optional[str], Optional[str]]:
        """Returns (http_method, route_path) if a FastAPI route decorator is found."""
        for d in method.decorator_list:
            if not isinstance(d, ast.Call):
                continue
            func = d.func
            name = (
                func.attr if isinstance(func, ast.Attribute) else
                (func.id if isinstance(func, ast.Name) else "")
            ).lower()
            http_method = HTTP_METHOD_MAP.get(name)
            if not http_method:
                continue
            route_path: Optional[str] = None
            if d.args and isinstance(d.args[0], ast.Constant) and isinstance(d.args[0].value, str):
                route_path = d.args[0].value
            return http_method, route_path
        return None, None

    def _extract_raw_body(self, method: AnyFunctionDef, source: str) -> str:
        lines = source.splitlines()
        start = method.lineno - 1
        end = method.end_lineno or start
        return "\n".join(lines[start:end])

    def _extract_calls(self, method: AnyFunctionDef) -> list[str]:
        calls: set[str] = set()
        for node in ast.walk(method):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            if isinstance(func, ast.Attribute):
                calls.add(func.attr)
            elif isinstance(func, ast.Name):
                calls.add(func.id)
        return list(calls)

    def _classify_node_type(self, decorators: list[str]) -> str:
        decorator_set = {d.lower() for d in decorators}
        if decorator_set & FASTAPI_ROUTE_DECORATORS:
            return "controller"
        if {"injectable", "service"} & decorator_set:
            return "service"
        return "utility"

    def _build_graph(self, methods: list[_ParsedMethod]) -> FlowGraph:
        nodes: list[FlowNode] = []
        edges: list[FlowEdge] = []
        method_index: dict[str, str] = {}

        for method in methods:
            node_id = (
                f"{method.file_path}:{method.class_name}#{method.method_name}:{method.line_number}"
            )
            method_index[method.method_name] = node_id

            nodes.append(
                FlowNode(
                    id=node_id,
                    label=method.flow_step_tag or method.method_name,
                    method_name=method.method_name,
                    type=method.node_type,
                    file_path=method.file_path,
                    line_number=method.line_number,
                    docstring=method.docstring,
                    raw_body=method.raw_body,
                    custom_tag=method.flow_step_tag,
                    http_method=method.http_method,
                    route_path=method.route_path,
                )
            )

        seen_edges: set[str] = set()
        for method in methods:
            from_id = (
                f"{method.file_path}:{method.class_name}#{method.method_name}:{method.line_number}"
            )
            for call in method.calls:
                to_id = method_index.get(call)
                if not to_id or to_id == from_id:
                    continue
                edge_key = f"{from_id}→{to_id}"
                if edge_key in seen_edges:
                    continue
                seen_edges.add(edge_key)
                edges.append(FlowEdge(from_id=from_id, to_id=to_id))

        return FlowGraph(
            nodes=nodes,
            edges=edges,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
