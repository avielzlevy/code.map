from __future__ import annotations

import asyncio
import json
import os
import queue
import threading
import time
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .constants import SIDECAR_API_PREFIX, SSE_HEARTBEAT_INTERVAL_S
from .logger import FlowLogger

LOGGER_CONTEXT = "SidecarService"


class SidecarService:
    def __init__(self) -> None:
        self._app = FastAPI(title="FlowMap Sidecar", docs_url=None, redoc_url=None)
        self._app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["GET"],
            allow_headers=["*"],
        )
        self._current_graph: Optional[dict] = None
        self._current_paths: list[dict] = []
        self._ai_enriching: bool = False
        self._server: Optional[uvicorn.Server] = None
        self._server_thread: Optional[threading.Thread] = None

        # SSE: each connected client gets a thread-safe SimpleQueue.
        # We use SimpleQueue (stdlib, no asyncio needed) so broadcast_event can
        # be called from any thread or event loop without cross-loop concerns.
        self._sse_queues: list[queue.SimpleQueue] = []
        self._sse_lock = threading.Lock()

        self._register_routes()

    # -------------------------------------------------------------------------
    # Public state setters — called by the engine
    # -------------------------------------------------------------------------

    def update_graph(self, graph: dict) -> None:
        self._current_graph = graph

    def update_paths(self, paths: list[dict]) -> None:
        self._current_paths = paths
        self._broadcast_event("paths-updated", paths)

    def set_ai_enriching(self, value: bool) -> None:
        self._ai_enriching = value
        self._broadcast_event("status", {"aiEnriching": value})

    def broadcast_rebuild_start(self) -> None:
        """Notify clients that a file-change rebuild is starting."""
        self._broadcast_event("rebuild-start", {"reason": "file-change"})

    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------

    def start(self, port: int) -> None:
        if self._server_thread and self._server_thread.is_alive():
            FlowLogger.warn(LOGGER_CONTEXT, "Sidecar already running")
            return

        config = uvicorn.Config(self._app, host="0.0.0.0", port=port, log_level="error")
        self._server = uvicorn.Server(config)
        self._server_thread = threading.Thread(target=self._server.run, daemon=True)
        self._server_thread.start()

        FlowLogger.info(
            LOGGER_CONTEXT,
            "Sidecar server started",
            {"port": port, "url": f"http://localhost:{port}"},
        )

    def stop(self) -> None:
        if self._server:
            self._server.should_exit = True
        # Drain all SSE client queues with a sentinel so generators exit cleanly.
        with self._sse_lock:
            for q in self._sse_queues:
                q.put(None)  # sentinel
            self._sse_queues.clear()

    # -------------------------------------------------------------------------
    # Private — SSE broadcast
    # -------------------------------------------------------------------------

    def _broadcast_event(self, event_type: str, data: Any) -> None:
        payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        with self._sse_lock:
            for q in self._sse_queues:
                q.put(payload)

    # -------------------------------------------------------------------------
    # Private — routes
    # -------------------------------------------------------------------------

    def _register_routes(self) -> None:
        @self._app.get(f"{SIDECAR_API_PREFIX}/events")
        async def events(request: Request) -> StreamingResponse:
            client_q: queue.SimpleQueue = queue.SimpleQueue()

            with self._sse_lock:
                self._sse_queues.append(client_q)

            FlowLogger.debug(
                LOGGER_CONTEXT,
                "SSE client connected",
                {"total": len(self._sse_queues)},
            )

            async def generator():
                # Push current state immediately on connect.
                yield f"event: status\ndata: {json.dumps({'aiEnriching': self._ai_enriching})}\n\n"
                if self._current_paths:
                    yield f"event: paths-updated\ndata: {json.dumps(self._current_paths)}\n\n"

                last_heartbeat = time.monotonic()
                try:
                    while True:
                        if await request.is_disconnected():
                            break

                        # Drain any queued events (non-blocking).
                        try:
                            while True:
                                item = client_q.get_nowait()
                                if item is None:  # sentinel — server shutting down
                                    return
                                yield item
                                last_heartbeat = time.monotonic()
                        except queue.Empty:
                            pass

                        # Send a keep-alive comment if the connection has been idle.
                        if time.monotonic() - last_heartbeat >= SSE_HEARTBEAT_INTERVAL_S:
                            yield ": ping\n\n"
                            last_heartbeat = time.monotonic()

                        await asyncio.sleep(0.1)
                finally:
                    with self._sse_lock:
                        try:
                            self._sse_queues.remove(client_q)
                        except ValueError:
                            pass
                    FlowLogger.debug(
                        LOGGER_CONTEXT,
                        "SSE client disconnected",
                        {"total": len(self._sse_queues)},
                    )

            return StreamingResponse(
                generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                },
            )

        @self._app.get(f"{SIDECAR_API_PREFIX}/paths")
        def get_paths() -> JSONResponse:
            return JSONResponse({"status": "success", "data": self._current_paths})

        @self._app.get(f"{SIDECAR_API_PREFIX}/graph")
        def get_graph() -> JSONResponse:
            if self._current_graph is None:
                return JSONResponse({"status": "error", "data": None}, status_code=503)
            return JSONResponse({"status": "success", "data": self._current_graph})

        @self._app.get(f"{SIDECAR_API_PREFIX}/health")
        def health() -> JSONResponse:
            return JSONResponse({"status": "success", "data": {"alive": True}})

        @self._app.get(f"{SIDECAR_API_PREFIX}/status")
        def status() -> JSONResponse:
            return JSONResponse({"status": "success", "data": {"aiEnriching": self._ai_enriching}})

        self._mount_frontend()

    def _mount_frontend(self) -> None:
        # __file__ is <repo>/backend/packages/python/flow_map/sidecar.py
        # Four levels up reaches the repo root, then into frontend/out
        frontend_out = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../../../../frontend/out")
        )

        if os.path.isdir(frontend_out):
            self._app.mount(
                "/", StaticFiles(directory=frontend_out, html=True), name="static"
            )
            FlowLogger.info(LOGGER_CONTEXT, "Serving compiled frontend", {"path": frontend_out})
        else:
            FlowLogger.warn(
                LOGGER_CONTEXT,
                "Frontend build not found; API-only mode",
                {"expected_path": frontend_out},
            )
