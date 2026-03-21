"""
AST parser — uses tree-sitter (py-tree-sitter) to parse Python source files
and build a FlowGraph. Framework-specific behaviour is driven by
FrameworkDescriptor loaded from framework_descriptors.json.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import tree_sitter_python as tspython
from tree_sitter import Language, Node, Parser, Tree

from .constants import EXCLUDED_DIRS, SUPPORTED_EXTENSIONS
from .exceptions import AstParserError
from .framework_detector import FrameworkDescriptor, detect_framework
from .logger import FlowLogger

LOGGER_CONTEXT = "AstParserService"

PY_LANGUAGE = Language(tspython.language())


# ---------------------------------------------------------------------------
# Public output shapes  (unchanged — no frontend impact)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Internal shapes
# ---------------------------------------------------------------------------

@dataclass
class _CallSite:
    method: str
    object: Optional[str] = None   # e.g. "user_service" from self.user_service.find()


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
    calls: list[_CallSite]
    # constructor-style injections: param_name → type_name  (populated for __init__)
    constructor_injections: dict[str, str]
    node_type: str


# ---------------------------------------------------------------------------
# AstParserService
# ---------------------------------------------------------------------------

class AstParserService:

    def parse(self, source_root: str) -> FlowGraph:
        FlowLogger.info(LOGGER_CONTEXT, "Starting AST parse (tree-sitter)", {"source_root": source_root})

        self._descriptor: FrameworkDescriptor = detect_framework(source_root)
        FlowLogger.info(LOGGER_CONTEXT, f"Detected framework: {self._descriptor.display_name}")

        self._parser = Parser(PY_LANGUAGE)
        self._source_root = source_root

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

    # -----------------------------------------------------------------------
    # File collection
    # -----------------------------------------------------------------------

    def _collect_source_files(self, root: str) -> list[str]:
        results: list[str] = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
            for filename in filenames:
                if os.path.splitext(filename)[1] in SUPPORTED_EXTENSIONS:
                    results.append(os.path.join(dirpath, filename))
        return results

    # -----------------------------------------------------------------------
    # File → _ParsedMethod[]
    # -----------------------------------------------------------------------

    def _parse_file(self, file_path: str) -> list[_ParsedMethod]:
        with open(file_path, "r", encoding="utf-8") as f:
            source = f.read()

        try:
            tree: Tree = self._parser.parse(source.encode("utf-8"))
        except Exception as err:
            raise AstParserError(file_path, str(err))

        self._source_lines = source.splitlines()
        methods: list[_ParsedMethod] = []

        for node in tree.root_node.children:
            methods.extend(self._collect_from_top_level(node, file_path))

        return methods

    def _collect_from_top_level(self, node: Node, file_path: str) -> list[_ParsedMethod]:
        """
        Top-level nodes can be:
          - class_definition           (undecorated class)
          - decorated_definition       (decorated class OR decorated function — Flask routes)
          - function_definition        (undecorated module-level function)
        """
        if node.type == "class_definition":
            return self._parse_class(node, [], file_path)

        if node.type == "decorated_definition":
            defn = node.child_by_field_name("definition")
            decorators = [c for c in node.children if c.type == "decorator"]
            if defn and defn.type == "class_definition":
                return self._parse_class(defn, decorators, file_path)
            if defn and defn.type == "function_definition":
                # Module-level decorated function — Flask-style route handlers
                m = self._parse_module_function(defn, decorators, file_path)
                return [m] if m else []

        return []

    def _parse_module_function(
        self,
        fn_node: Node,
        decorator_nodes: list[Node],
        file_path: str,
    ) -> Optional[_ParsedMethod]:
        """Parses a top-level (non-class) decorated function — used by Flask routes."""
        name_node = fn_node.child_by_field_name("name")
        method_name = name_node.text.decode() if name_node else "anonymous"

        method_decorators = [self._get_decorator_name(d) for d in decorator_nodes]
        method_decorators = [n for n in method_decorators if n]

        flow_step_tag = self._extract_flow_step_tag(decorator_nodes)
        http_method, route_path = self._extract_http_decorator(decorator_nodes)
        docstring = self._extract_docstring(fn_node)

        body_node = fn_node.child_by_field_name("body")
        raw_body = self._node_text(fn_node)
        line_number = fn_node.start_point[0] + 1
        calls = self._extract_call_sites(fn_node) if body_node else []

        # Derive a readable class name from the file path
        class_name = os.path.basename(file_path).replace(".py", "").replace("_", " ").title().replace(" ", "") + "Routes"

        node_type = "controller" if http_method else "utility"

        return _ParsedMethod(
            class_name=class_name,
            method_name=method_name,
            class_decorators=[],
            method_decorators=method_decorators,
            flow_step_tag=flow_step_tag,
            http_method=http_method,
            route_path=route_path,
            docstring=docstring,
            raw_body=raw_body,
            file_path=file_path,
            line_number=line_number,
            calls=calls,
            constructor_injections={},
            node_type=node_type,
        )

    # -----------------------------------------------------------------------
    # Class → _ParsedMethod[]
    # -----------------------------------------------------------------------

    def _parse_class(
        self,
        class_node: Node,
        class_decorator_nodes: list[Node],
        file_path: str,
    ) -> list[_ParsedMethod]:
        class_name_node = class_node.child_by_field_name("name")
        class_name = class_name_node.text.decode() if class_name_node else "AnonymousClass"

        class_decorators = [self._get_decorator_name(d) for d in class_decorator_nodes]
        class_decorators = [n for n in class_decorators if n]
        node_type = self._classify_node_type(class_decorators, class_node)

        body = class_node.child_by_field_name("body")
        if not body:
            return []

        constructor_injections = self._extract_constructor_injections(body)
        methods: list[_ParsedMethod] = []

        for child in body.children:
            method_node, method_decorator_nodes = self._unwrap_definition(child)
            if method_node is None or method_node.type != "function_definition":
                continue

            method_name_node = method_node.child_by_field_name("name")
            method_name = method_name_node.text.decode() if method_name_node else "anonymous"

            # Skip __init__ — we only use it for injection mapping
            if method_name == "__init__":
                continue

            method_decorators = [self._get_decorator_name(d) for d in method_decorator_nodes]
            method_decorators = [n for n in method_decorators if n]

            flow_step_tag = self._extract_flow_step_tag(method_decorator_nodes)
            http_method, route_path = self._extract_http_decorator(method_decorator_nodes)
            docstring = self._extract_docstring(method_node)

            body_node = method_node.child_by_field_name("body")
            raw_body = self._node_text(method_node)
            line_number = method_node.start_point[0] + 1  # tree-sitter is 0-indexed
            calls = self._extract_call_sites(method_node) if body_node else []

            methods.append(_ParsedMethod(
                class_name=class_name,
                method_name=method_name,
                class_decorators=class_decorators,
                method_decorators=method_decorators,
                flow_step_tag=flow_step_tag,
                http_method=http_method,
                route_path=route_path,
                docstring=docstring,
                raw_body=raw_body,
                file_path=file_path,
                line_number=line_number,
                calls=calls,
                constructor_injections=constructor_injections,
                node_type=node_type,
            ))

        # Post-classify 1: for frameworks without class-level controller decorators (FastAPI),
        # if any method has an HTTP route decorator, the whole class is a controller.
        if node_type == "utility" and any(m.http_method for m in methods):
            node_type = "controller"
            for m in methods:
                m.node_type = "controller"

        # Post-classify 2: Django REST ViewSets — standard action methods are HTTP handlers.
        viewset_methods = set(self._descriptor.viewset_methods)
        if viewset_methods and node_type == "controller":
            http_map = self._descriptor.http_method_map
            for m in methods:
                if m.http_method is None and m.method_name in viewset_methods:
                    m.http_method = http_map.get(m.method_name, "GET")
                    m.node_type = "controller"

        return methods

    # -----------------------------------------------------------------------
    # Unwrap decorated_definition → (definition_node, decorator_nodes)
    # -----------------------------------------------------------------------

    def _unwrap_definition(self, node: Node) -> tuple[Optional[Node], list[Node]]:
        """
        A class body child is either:
          - function_definition   (no decorators)
          - decorated_definition  (has decorators wrapping a function_definition)
        Returns (function_definition_node, [decorator, ...])
        """
        if node.type == "function_definition":
            return node, []

        if node.type == "decorated_definition":
            defn = node.child_by_field_name("definition")
            decorators = [c for c in node.children if c.type == "decorator"]
            return defn, decorators

        return None, []

    # -----------------------------------------------------------------------
    # Decorator helpers
    # -----------------------------------------------------------------------

    def _get_decorator_name(self, decorator_node: Node) -> Optional[str]:
        """
        Returns the unqualified decorator name.
        @flow_step("tag")          → "flow_step"
        @router.get("/path")       → "get"
        @Injectable                → "Injectable"
        """
        # child(0) = "@", child(1) = expression
        if decorator_node.child_count < 2:
            return None
        expr = decorator_node.children[1]

        if expr.type == "identifier":
            return expr.text.decode()

        if expr.type == "call":
            fn = expr.child_by_field_name("function")
            if fn is None:
                return None
            if fn.type == "identifier":
                return fn.text.decode()
            if fn.type == "attribute":
                attr = fn.child_by_field_name("attribute")
                return attr.text.decode() if attr else None

        # bare attribute without call: @router.get (unusual but handle it)
        if expr.type == "attribute":
            attr = expr.child_by_field_name("attribute")
            return attr.text.decode() if attr else None

        return None

    def _get_decorator_first_string_arg(self, decorator_node: Node) -> Optional[str]:
        """Returns the first string argument of a decorator call, stripped of quotes."""
        if decorator_node.child_count < 2:
            return None
        expr = decorator_node.children[1]

        if expr.type != "call":
            return None

        args = expr.child_by_field_name("arguments")
        if not args:
            return None

        for child in args.named_children:
            if child.type == "string":
                return self._decode_string_node(child)

        return None

    def _decode_string_node(self, node: Node) -> str:
        """Extracts the raw content of a string literal, stripping quotes."""
        text = node.text.decode()
        # Handle f-strings, raw strings, etc. by stripping prefix + quotes
        for quote in ('"""', "'''", '"', "'"):
            if quote in text:
                inner = text.split(quote, 1)[1]
                return inner.rsplit(quote, 1)[0]
        return text

    # -----------------------------------------------------------------------
    # Specific decorator extractors
    # -----------------------------------------------------------------------

    def _extract_flow_step_tag(self, decorator_nodes: list[Node]) -> Optional[str]:
        decorator_name = self._descriptor.flow_step_decorator
        for d in decorator_nodes:
            if self._get_decorator_name(d) == decorator_name:
                return self._get_decorator_first_string_arg(d)
        return None

    def _extract_http_decorator(
        self, decorator_nodes: list[Node]
    ) -> tuple[Optional[str], Optional[str]]:
        route_decorators = self._descriptor.route_decorators
        http_method_map = self._descriptor.http_method_map

        for d in decorator_nodes:
            name = self._get_decorator_name(d)
            if not name:
                continue
            name_lower = name.lower()
            if name_lower not in route_decorators:
                continue
            http_method = http_method_map.get(name_lower)
            route_path = self._get_decorator_first_string_arg(d)
            return http_method, route_path

        return None, None

    # -----------------------------------------------------------------------
    # Constructor injection extraction
    # -----------------------------------------------------------------------

    def _extract_constructor_injections(self, class_body: Node) -> dict[str, str]:
        """
        Reads __init__ parameters to build a param_name → type_name map.
        Only captures typed parameters.
        """
        injections: dict[str, str] = {}

        for child in class_body.children:
            fn_node, _ = self._unwrap_definition(child)
            if fn_node is None or fn_node.type != "function_definition":
                continue

            name_node = fn_node.child_by_field_name("name")
            if not name_node or name_node.text.decode() != "__init__":
                continue

            params = fn_node.child_by_field_name("parameters")
            if not params:
                break

            for param in params.named_children:
                # typed_parameter: identifier + type annotation
                if param.type != "typed_parameter":
                    continue
                # First child is the identifier (param name)
                id_child = next(
                    (c for c in param.children if c.type == "identifier"), None
                )
                # type annotation: the "type" field
                type_child = param.child_by_field_name("type")
                if not id_child or not type_child:
                    continue

                param_name = id_child.text.decode()
                if param_name == "self":
                    continue

                # Strip Optional[X] → X
                type_name = self._resolve_type_name(type_child)
                if type_name:
                    injections[param_name] = type_name

            break  # only one __init__

        return injections

    def _resolve_type_name(self, type_node: Node) -> Optional[str]:
        """
        Extracts the base type name from a type annotation node.
        Handles: UserService, Optional[UserService], List[UserService]
        """
        text = type_node.text.decode().strip()
        # Optional[X] → X
        if text.startswith("Optional[") and text.endswith("]"):
            text = text[len("Optional["):-1]
        # List[X], Sequence[X] etc. → keep outer for now (services are plain types)
        return text.split("[")[0].strip() or None

    # -----------------------------------------------------------------------
    # Call site extraction
    # -----------------------------------------------------------------------

    def _extract_call_sites(self, method_node: Node) -> list[_CallSite]:
        calls: dict[str, _CallSite] = {}

        def walk(node: Node) -> None:
            if node.type == "call":
                fn = node.child_by_field_name("function")
                if fn is not None:
                    if fn.type == "attribute":
                        method_name_node = fn.child_by_field_name("attribute")
                        obj_node = fn.child_by_field_name("object")

                        method_name = method_name_node.text.decode() if method_name_node else None
                        if method_name:
                            obj_name = self._resolve_call_object(obj_node)
                            key = f"{obj_name or ''}#{method_name}"
                            if key not in calls:
                                calls[key] = _CallSite(method=method_name, object=obj_name)

                    elif fn.type == "identifier":
                        method_name = fn.text.decode()
                        key = f"#{method_name}"
                        if key not in calls:
                            calls[key] = _CallSite(method=method_name)

            for child in node.children:
                walk(child)

        walk(method_node)
        return list(calls.values())

    def _resolve_call_object(self, obj_node: Optional[Node]) -> Optional[str]:
        """
        Resolves the object of a method call to a service name.
        self.user_service.find() → "user_service"
        user_service.find()      → "user_service"
        self.find()              → None (direct self call)
        """
        if obj_node is None:
            return None

        if obj_node.type == "identifier":
            name = obj_node.text.decode()
            return None if name == "self" else name

        if obj_node.type == "attribute":
            # self.user_service → attribute="user_service", object=self
            attr = obj_node.child_by_field_name("attribute")
            inner_obj = obj_node.child_by_field_name("object")
            if attr and inner_obj and inner_obj.type == "identifier":
                if inner_obj.text.decode() == "self":
                    return attr.text.decode()

        return None

    # -----------------------------------------------------------------------
    # Docstring extraction
    # -----------------------------------------------------------------------

    def _extract_docstring(self, func_node: Node) -> Optional[str]:
        """
        The first statement in a function body is the docstring if it's
        an expression_statement containing a string literal.
        """
        body = func_node.child_by_field_name("body")
        if not body:
            return None

        for child in body.children:
            if child.type != "expression_statement":
                break
            string_child = next(
                (c for c in child.children if c.type == "string"), None
            )
            if string_child:
                return self._decode_string_node(string_child)
            break

        return None

    # -----------------------------------------------------------------------
    # Node text extraction
    # -----------------------------------------------------------------------

    def _node_text(self, node: Node) -> str:
        """Returns the source text covered by this node."""
        if node.text:
            return node.text.decode(errors="replace")
        # Fallback: slice source lines
        start_row = node.start_point[0]
        end_row = node.end_point[0]
        return "\n".join(self._source_lines[start_row : end_row + 1])

    # -----------------------------------------------------------------------
    # Node classification
    # -----------------------------------------------------------------------

    def _classify_node_type(
        self,
        decorators: list[str],
        class_node: Optional[Node] = None,
    ) -> str:
        desc = self._descriptor
        deco_set = {d.lower() for d in decorators}

        controller_set = {d.lower() for d in desc.controller_decorators}
        service_set = {d.lower() for d in desc.service_decorators}

        if deco_set & controller_set:
            return "controller"
        if deco_set & service_set:
            return "service"

        # Django REST: detect ViewSet by parent class name
        if class_node is not None:
            superclasses = self._extract_superclass_names(class_node)
            viewset_bases = {
                "viewset", "modelviewset", "readonlymodelviewset",
                "genericviewset", "apiview",
            }
            if any(s.lower() in viewset_bases for s in superclasses):
                return "controller"

        return "utility"

    def _extract_superclass_names(self, class_node: Node) -> list[str]:
        """Returns the base class names from a class definition."""
        names: list[str] = []
        args_node = class_node.child_by_field_name("superclasses")
        if not args_node:
            return names
        for child in args_node.named_children:
            if child.type == "identifier":
                names.append(child.text.decode())
            elif child.type == "attribute":
                # e.g. viewsets.ModelViewSet → take the attribute part
                attr = child.child_by_field_name("attribute")
                if attr:
                    names.append(attr.text.decode())
        return names

    # -----------------------------------------------------------------------
    # Graph construction
    # -----------------------------------------------------------------------

    def _build_graph(self, methods: list[_ParsedMethod]) -> FlowGraph:
        nodes: list[FlowNode] = []
        edges: list[FlowEdge] = []

        # Collision-free index: ClassName#method_name → node_id
        method_index: dict[str, str] = {}
        # Ambiguity index: method_name → [node_id, ...]
        method_name_index: dict[str, list[str]] = {}

        for method in methods:
            node_id = (
                f"{method.file_path}:{method.class_name}#{method.method_name}:{method.line_number}"
            )
            method_index[f"{method.class_name}#{method.method_name}"] = node_id

            method_name_index.setdefault(method.method_name, []).append(node_id)

            nodes.append(FlowNode(
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
            ))

        seen_edges: set[str] = set()

        for method in methods:
            from_id = (
                f"{method.file_path}:{method.class_name}#{method.method_name}:{method.line_number}"
            )

            for call in method.calls:
                candidates = method_name_index.get(call.method, [])
                to_id: Optional[str] = None

                if len(candidates) == 1:
                    to_id = candidates[0]

                elif len(candidates) > 1 and call.object:
                    # Resolve via __init__ injection mapping
                    injected_class = method.constructor_injections.get(call.object)
                    if injected_class:
                        to_id = method_index.get(f"{injected_class}#{call.method}")
                        if not to_id:
                            # Param renamed — filter candidates by class name in node_id
                            matches = [c for c in candidates if f":{injected_class}#" in c]
                            if len(matches) == 1:
                                to_id = matches[0]

                if to_id and to_id != from_id:
                    edge_key = f"{from_id}→{to_id}"
                    if edge_key not in seen_edges:
                        seen_edges.add(edge_key)
                        edges.append(FlowEdge(from_id=from_id, to_id=to_id))

        return FlowGraph(
            nodes=nodes,
            edges=edges,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
