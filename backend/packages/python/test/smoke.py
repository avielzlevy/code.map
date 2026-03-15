"""
End-to-end smoke test.
Run with:  python test/smoke.py   (from packages/python/)

Verifies:
1. AST parser produces a valid graph from the fixture directory.
2. Cache set/get round-trip works correctly.
3. Sidecar server starts and serves the graph.
4. Health and graph endpoints return expected responses.
"""

import asyncio
import json
import os
import sys
import tempfile
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flow_map.ast_parser import AstParserService
from flow_map.cache import CacheService
from flow_map.sidecar import SidecarService

SIDECAR_PORT = 4569  # Use a distinct port to avoid conflicts
FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def get(url: str, timeout: float = 5.0) -> tuple[int, dict]:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read())


def wait_for_server(port: int, retries: int = 10, delay: float = 0.3) -> None:
    for _ in range(retries):
        try:
            get(f"http://localhost:{port}/api/flow-map/health")
            return
        except Exception:
            time.sleep(delay)
    raise RuntimeError(f"Sidecar did not start on port {port} within {retries * delay}s")


def run() -> None:
    print("--- FlowMap smoke test ---\n")

    # 1. Parse fixtures
    parser = AstParserService()
    graph = parser.parse(FIXTURE_DIR)
    print(f"[AST]  Parsed {len(graph.nodes)} nodes, {len(graph.edges)} edges")

    tagged = next((n for n in graph.nodes if n.custom_tag), None)
    if not tagged:
        raise AssertionError("Expected at least one node with a @flow_step tag")
    print(f'[AST]  @flow_step node → label: "{tagged.label}"')

    docstring_node = next((n for n in graph.nodes if n.docstring), None)
    if not docstring_node:
        raise AssertionError("Expected at least one node with a docstring")
    print(f'[AST]  Docstring node → "{(docstring_node.docstring or "")[:60]}..."')

    # 2. Cache round-trip
    with tempfile.TemporaryDirectory() as tmp:
        cache = CacheService(tmp)
        h = cache.hash_body("def test(): pass")
        cache.set("smoke::test", h, "Test summary")

        hit = cache.get("smoke::test", h)
        assert hit == "Test summary", f"Cache hit returned wrong value: {hit!r}"
        print("[Cache] Set/get round-trip OK")

        miss = cache.get("smoke::test", "wrong-hash")
        assert miss is None, f"Expected None on hash mismatch, got: {miss!r}"
        print("[Cache] Hash-mismatch returns None OK")

    # 3. Sidecar server
    sidecar = SidecarService()

    import dataclasses
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
    print("\n✓ All smoke checks passed")


if __name__ == "__main__":
    try:
        run()
    except Exception as err:
        print(f"\n✗ Smoke test failed: {err}", file=sys.stderr)
        sys.exit(1)
