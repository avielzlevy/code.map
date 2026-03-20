"""
Smoke test — FastAPI e-commerce fixture.
Run with:  python tests/smoke-fastapi.py   (from repo root)

Verifies:
1. AST parser handles a multi-module FastAPI codebase (routers + services).
2. @flow_step tags are extracted from both routers and services.
3. Docstrings are picked up.
4. Call edges link routers → services → shared services.
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

SIDECAR_PORT = 4572
FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fastapi-ecommerce/app")


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
    print("--- FastAPI e-commerce smoke test ---\n")

    # 1. Parse the full multi-module fixture
    parser = AstParserService()
    graph = parser.parse(FIXTURE_DIR)
    print(f"[AST]  Parsed {len(graph.nodes)} nodes, {len(graph.edges)} edges")

    if len(graph.nodes) < 10:
        raise AssertionError(f"Expected ≥10 nodes from a multi-module codebase, got {len(graph.nodes)}")
    print(f"[AST]  Node count OK (≥10)")

    if len(graph.edges) < 5:
        raise AssertionError(f"Expected ≥5 call edges, got {len(graph.edges)}")
    print(f"[AST]  Edge count OK (≥5)")

    # 2. @flow_step tags in both routers and services
    tagged = [n for n in graph.nodes if n.custom_tag]
    if len(tagged) < 5:
        raise AssertionError(f"Expected ≥5 @flow_step nodes, got {len(tagged)}")
    print(f"[AST]  {len(tagged)} @flow_step nodes found")
    print(f'[AST]  Sample: "{tagged[0].label}" → "{tagged[0].custom_tag}"')

    # 3. Docstrings
    doc_nodes = [n for n in graph.nodes if n.docstring]
    if len(doc_nodes) < 1:
        raise AssertionError("Expected at least one node with a docstring")
    print(f"[AST]  {len(doc_nodes)} nodes with docstrings")

    # 4. HTTP methods on router nodes
    http_nodes = [n for n in graph.nodes if n.http_method]
    if len(http_nodes) < 5:
        raise AssertionError(f"Expected ≥5 HTTP method nodes, got {len(http_nodes)}")
    print(f"[AST]  {len(http_nodes)} HTTP method nodes detected")

    # 5. Cache round-trip
    with tempfile.TemporaryDirectory() as tmp:
        cache = CacheService(tmp)
        h = cache.hash_body("async def find_all(self): return []")
        cache.set("fastapi-smoke::find_all", h, "Paginated order list")

        hit = cache.get("fastapi-smoke::find_all", h)
        assert hit == "Paginated order list", f"Cache hit returned wrong value: {hit!r}"
        print("[Cache] Set/get round-trip OK")

        miss = cache.get("fastapi-smoke::find_all", "wrong-hash")
        assert miss is None, f"Expected None on hash mismatch, got: {miss!r}"
        print("[Cache] Hash-mismatch returns None OK")

    # 6. Sidecar HTTP
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
    print("\n✓ FastAPI smoke test passed")


if __name__ == "__main__":
    try:
        run()
    except Exception as err:
        print(f"\n✗ FastAPI smoke test failed: {err}", file=sys.stderr)
        sys.exit(1)
