from __future__ import annotations

import asyncio
import os
import threading
import time
from typing import Awaitable, Callable, Optional

from .constants import (
    EXCLUDED_DIRS,
    FILE_WATCHER_DEBOUNCE_S,
    FILE_WATCHER_POLL_INTERVAL_S,
    SUPPORTED_EXTENSIONS,
)
from .logger import FlowLogger

LOGGER_CONTEXT = "FileWatcherService"


class FileWatcherService:
    """
    Polls ``source_root`` for mtime changes on supported source files and calls
    ``on_rebuild`` (an async coroutine) after a short debounce period.

    Uses stdlib only — no external dependencies. Runs a background daemon thread
    so it does not block the engine's event loop.
    """

    def __init__(
        self,
        source_root: str,
        on_rebuild: Callable[[], Awaitable[None]],
        debounce_s: float = FILE_WATCHER_DEBOUNCE_S,
        poll_interval_s: float = FILE_WATCHER_POLL_INTERVAL_S,
    ) -> None:
        self._source_root = source_root
        self._on_rebuild = on_rebuild
        self._debounce_s = debounce_s
        self._poll_interval_s = poll_interval_s

        self._mtimes: dict[str, float] = {}
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._rebuild_timer: Optional[threading.Timer] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        """Start the watcher on *loop* (the engine's event loop)."""
        self._loop = loop
        self._mtimes = self._scan_mtimes()
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._watch_loop, daemon=True, name="flow-file-watcher")
        self._thread.start()
        FlowLogger.info(LOGGER_CONTEXT, "File watcher started", {"source_root": self._source_root})

    def stop(self) -> None:
        self._stop_event.set()
        if self._rebuild_timer:
            self._rebuild_timer.cancel()
            self._rebuild_timer = None

    # -------------------------------------------------------------------------
    # Private
    # -------------------------------------------------------------------------

    def _scan_mtimes(self) -> dict[str, float]:
        mtimes: dict[str, float] = {}
        for dirpath, dirnames, filenames in os.walk(self._source_root):
            # Prune excluded directories in-place so os.walk won't descend into them.
            dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
            for filename in filenames:
                if os.path.splitext(filename)[1] in SUPPORTED_EXTENSIONS:
                    filepath = os.path.join(dirpath, filename)
                    try:
                        mtimes[filepath] = os.stat(filepath).st_mtime
                    except OSError:
                        pass
        return mtimes

    def _watch_loop(self) -> None:
        while not self._stop_event.is_set():
            self._stop_event.wait(self._poll_interval_s)
            if self._stop_event.is_set():
                break

            new_mtimes = self._scan_mtimes()
            all_paths = set(new_mtimes) | set(self._mtimes)
            changed = any(new_mtimes.get(p) != self._mtimes.get(p) for p in all_paths)

            if changed:
                self._mtimes = new_mtimes
                FlowLogger.debug(LOGGER_CONTEXT, "File change detected — scheduling rebuild")
                self._schedule_rebuild()

    def _schedule_rebuild(self) -> None:
        if self._rebuild_timer:
            self._rebuild_timer.cancel()

        self._rebuild_timer = threading.Timer(self._debounce_s, self._trigger_rebuild)
        self._rebuild_timer.daemon = True
        self._rebuild_timer.start()

    def _trigger_rebuild(self) -> None:
        self._rebuild_timer = None
        if self._loop and not self._loop.is_closed():
            FlowLogger.info(LOGGER_CONTEXT, "Triggering rebuild after file change")
            future = asyncio.run_coroutine_threadsafe(self._safe_rebuild(), self._loop)
            # Attach a no-op callback so unhandled-future warnings are suppressed.
            future.add_done_callback(lambda _: None)

    async def _safe_rebuild(self) -> None:
        try:
            await self._on_rebuild()
        except Exception as err:
            FlowLogger.error(LOGGER_CONTEXT, "Rebuild after file change failed", {"error": str(err)})
