from __future__ import annotations

import os
import threading
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .constants import SIDECAR_API_PREFIX
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
        self._server: Optional[uvicorn.Server] = None
        self._server_thread: Optional[threading.Thread] = None
        self._register_routes()

    def update_graph(self, graph: dict) -> None:
        self._current_graph = graph

    def update_paths(self, paths: list[dict]) -> None:
        self._current_paths = paths

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

    def _register_routes(self) -> None:
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
