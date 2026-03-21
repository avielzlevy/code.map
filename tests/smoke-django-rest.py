"""
Smoke test — Django REST Framework e-commerce fixture.
Run with:  python tests/smoke-django-rest.py   (from repo root)

Verifies:
1. AST parser detects ViewSet classes (ModelViewSet, ReadOnlyModelViewSet).
2. Standard ViewSet actions (list, create, retrieve, update, destroy) are assigned HTTP methods.
3. @flow_step tags are extracted from service classes.
4. Call edges link ViewSet actions → services.
5. Sidecar serves the graph over HTTP.
"""

import json
import os
import sys
import tempfile
import time
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend/packages/python"))

from flow_map.ast_parser import AstParserService
from flow_map.cache import CacheService
from flow_map.sidecar import SidecarService

SIDECAR_PORT = 4577
FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "django-rest-ecommerce/app")


def get(url: str, timeout: float = 5.0) -> tuple[int, dict]:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read())


def wait_for_server(port: int, retries: int = 15, delay: float = 0.3) -> None:
    for _ in range(retries):
        try:
            get(f"http://localhost:{port}/api/flow-map/health")
            return
        except Exception:
            time.sleep(delay)
    raise RuntimeError(f"Sidecar did not start on port {port} within {retries * delay}s")


def run() -> None:
    print("--- Django REST Framework e-commerce smoke test ---\n")

    # 1. Parse the full Django REST fixture (ViewSets + service classes)
    parser = AstParserService()
    graph = parser.parse(FIXTURE_DIR)
    print(f"[AST]  Parsed {len(graph.nodes)} nodes, {len(graph.edges)} edges")

    if len(graph.nodes) < 8:
        raise AssertionError(f"Expected ≥8 nodes from a multi-ViewSet DRF app, got {len(graph.nodes)}")
    print("[AST]  Node count OK (≥8)")

    # Django REST ViewSet methods call services via self.X_service.method() — edges
    # are generated when the parser can correlate the call site to a known node.
    # Simple service stubs produce fewer linkable calls than decorator-style frameworks.
    if len(graph.edges) < 1:
        raise AssertionError(f"Expected ≥1 call edge from ViewSet → service, got {len(graph.edges)}")
    print(f"[AST]  Edge count OK (≥1, got {len(graph.edges)})")

    # 2. ViewSet actions must have HTTP methods assigned
    #    (list→GET, create→POST, retrieve→GET, update→PUT, destroy→DELETE)
    http_nodes = [n for n in graph.nodes if n.http_method]
    if len(http_nodes) < 5:
        raise AssertionError(
            f"Expected ≥5 nodes with HTTP methods (ViewSet actions), got {len(http_nodes)}"
        )
    print(f"[AST]  {len(http_nodes)} ViewSet action nodes with HTTP methods")

    # 3. Spot-check: at least one GET and one POST must be present
    methods_found = {n.http_method for n in http_nodes}
    if "GET" not in methods_found:
        raise AssertionError(f"Expected GET in HTTP methods, found: {methods_found}")
    if "POST" not in methods_found:
        raise AssertionError(f"Expected POST in HTTP methods, found: {methods_found}")
    print(f"[AST]  HTTP methods present: {sorted(methods_found)}")

    # 4. @flow_step tags on service classes (UsersService.create etc.)
    tagged = [n for n in graph.nodes if n.custom_tag]
    if len(tagged) < 1:
        raise AssertionError(f"Expected ≥1 @flow_step node from service classes, got {len(tagged)}")
    print(f"[AST]  {len(tagged)} @flow_step nodes found")
    print(f'[AST]  Sample: "{tagged[0].label}" → "{tagged[0].custom_tag}"')

    # 5. Docstrings on ViewSet classes/methods
    doc_nodes = [n for n in graph.nodes if n.docstring]
    if len(doc_nodes) < 1:
        raise AssertionError("Expected at least one node with a docstring")
    print(f"[AST]  {len(doc_nodes)} nodes with docstrings")

    # 6. Cache round-trip
    with tempfile.TemporaryDirectory() as tmp:
        cache = CacheService(tmp)
        h = cache.hash_body("def list(self, request): return self.order_service.find_all()")
        cache.set("django-smoke::list_orders", h, "List all orders for user")

        hit = cache.get("django-smoke::list_orders", h)
        assert hit == "List all orders for user", f"Cache hit returned wrong value: {hit!r}"
        print("[Cache] Set/get round-trip OK")

        miss = cache.get("django-smoke::list_orders", "wrong-hash")
        assert miss is None, f"Expected None on hash mismatch, got: {miss!r}"
        print("[Cache] Hash-mismatch returns None OK")

    # 7. Sidecar HTTP
    import dataclasses
    sidecar = SidecarService()
    graph_dict = {
        "nodes": [dataclasses.asdict(n) for n in graph.nodes],
        "edges": [{"from": e.from_id, "to": e.to_id} for e in graph.edges],
        "generatedAt": graph.generated_at,
    }
    sidecar.update_graph(graph_dict)
    sidecar.start(SIDECAR_PORT)
    wait_for_server(SIDECAR_PORT)
    print(f"[Sidecar] Started on http://localhost:{SIDECAR_PORT}")

    status, body = get(f"http://localhost:{SIDECAR_PORT}/api/flow-map/health")
    assert status == 200, f"Health returned {status}"
    print("[Sidecar] /health → 200 OK")

    status, body = get(f"http://localhost:{SIDECAR_PORT}/api/flow-map/graph")
    assert status == 200, f"/graph returned {status}"
    assert len(body["data"]["nodes"]) == len(graph.nodes), (
        f"Expected {len(graph.nodes)} nodes, got {len(body['data']['nodes'])}"
    )
    print(
        f"[Sidecar] /graph → 200, "
        f"{len(body['data']['nodes'])} nodes, {len(body['data']['edges'])} edges"
    )

    sidecar.stop()
    print("\n✓ Django REST Framework smoke test passed")


if __name__ == "__main__":
    try:
        run()
    except Exception as err:
        print(f"\n✗ Django REST Framework smoke test failed: {err}", file=sys.stderr)
        sys.exit(1)
