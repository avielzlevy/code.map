import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Optional

from .constants import FLOW_CACHE_INDEX_FILE
from .exceptions import CacheError
from .logger import FlowLogger

LOGGER_CONTEXT = "CacheService"


class CacheService:
    def __init__(self, cache_path: str) -> None:
        self._cache_path = cache_path
        self._index_path = os.path.join(self._cache_path, FLOW_CACHE_INDEX_FILE)
        self._index: dict = {}
        self._ensure_cache_dir()
        self._load_index()

    def hash_body(self, raw_body: str) -> str:
        return hashlib.sha256(raw_body.encode()).hexdigest()

    def get(self, node_id: str, current_hash: str) -> Optional[str]:
        entry = self._index.get(node_id)
        if not entry:
            return None

        if entry["bodyHash"] != current_hash:
            FlowLogger.debug(LOGGER_CONTEXT, "Cache miss: function body changed", {"node_id": node_id})
            return None

        FlowLogger.debug(LOGGER_CONTEXT, "Cache hit", {"node_id": node_id})
        return entry["summary"]

    def set(self, node_id: str, body_hash: str, summary: str) -> None:
        self._index[node_id] = {
            "bodyHash": body_hash,
            "summary": summary,
            "cachedAt": datetime.now(timezone.utc).isoformat(),
        }
        self._persist_index()

    def _ensure_cache_dir(self) -> None:
        os.makedirs(self._cache_path, exist_ok=True)

    def _load_index(self) -> None:
        if not os.path.exists(self._index_path):
            self._index = {}
            return

        try:
            with open(self._index_path, "r", encoding="utf-8") as f:
                self._index = json.load(f)
        except Exception as err:
            FlowLogger.warn(
                LOGGER_CONTEXT,
                "Failed to load cache index, starting fresh",
                {"error": str(err)},
            )
            self._index = {}

    def _persist_index(self) -> None:
        try:
            with open(self._index_path, "w", encoding="utf-8") as f:
                json.dump(self._index, f, indent=2)
        except Exception as err:
            raise CacheError("persist index", str(err))
