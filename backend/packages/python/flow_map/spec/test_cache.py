import os
import tempfile
import json
import pytest

from flow_map.cache import CacheService


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as d:
        yield d


@pytest.fixture
def cache(temp_dir: str) -> CacheService:
    return CacheService(temp_dir)


class TestHashBody:
    def test_consistent_for_same_input(self, cache: CacheService):
        h1 = cache.hash_body("def foo(): pass")
        h2 = cache.hash_body("def foo(): pass")
        assert h1 == h2
        assert len(h1) == 64  # SHA-256 hex

    def test_different_for_different_input(self, cache: CacheService):
        h1 = cache.hash_body("def foo(): pass")
        h2 = cache.hash_body("def bar(): pass")
        assert h1 != h2


class TestGetSet:
    NODE_ID = "src/user_service.py:UserService#create:10"
    BODY = "async def create(self): return await self.db.save(user)"

    def test_returns_none_for_unknown_node(self, cache: CacheService):
        assert cache.get(self.NODE_ID, "any-hash") is None

    def test_returns_summary_after_set(self, cache: CacheService):
        h = cache.hash_body(self.BODY)
        cache.set(self.NODE_ID, h, "Persists user to database")
        assert cache.get(self.NODE_ID, h) == "Persists user to database"

    def test_returns_none_when_hash_mismatch(self, cache: CacheService):
        h = cache.hash_body(self.BODY)
        cache.set(self.NODE_ID, h, "Old summary")

        stale = cache.hash_body("async def create(self): return something_else()")
        assert cache.get(self.NODE_ID, stale) is None


class TestPersistence:
    def test_loads_entries_across_instances(self, temp_dir: str):
        c1 = CacheService(temp_dir)
        node_id = "src/foo.py:Foo#bar:1"
        h = c1.hash_body("bar body")
        c1.set(node_id, h, "Cached summary")

        c2 = CacheService(temp_dir)
        assert c2.get(node_id, h) == "Cached summary"

    def test_starts_fresh_on_corrupt_index(self, temp_dir: str):
        index_path = os.path.join(temp_dir, "index.json")
        with open(index_path, "w") as f:
            f.write("{invalid json")

        # Must not raise
        cache = CacheService(temp_dir)
        assert cache.get("any", "any") is None
