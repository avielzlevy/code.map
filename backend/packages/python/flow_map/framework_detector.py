"""
Framework detector — reads framework-descriptors.json and identifies
which Python framework is active in the target project.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Optional

# Path is relative to this file so it works regardless of cwd
_DESCRIPTORS_PATH = os.path.join(os.path.dirname(__file__), "framework_descriptors.json")

# Detection priority for Python frameworks (most specific first)
_PY_PRIORITY = ["django_rest", "fastapi", "flask"]


@dataclass
class FrameworkDescriptor:
    language: str
    display_name: str
    detection_manifest_file: str
    detection_manifest_key: str
    route_style: str  # "decorator" | "chained" | "export" | "mixed"
    controller_decorators: list[str] = field(default_factory=list)
    service_decorators: list[str] = field(default_factory=list)
    route_decorators: list[str] = field(default_factory=list)
    flow_step_decorator: str = "flow_step"
    http_method_map: dict[str, str] = field(default_factory=dict)
    viewset_methods: list[str] = field(default_factory=list)


def _load_descriptors() -> dict[str, FrameworkDescriptor]:
    with open(_DESCRIPTORS_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    result: dict[str, FrameworkDescriptor] = {}
    for key, data in raw["frameworks"].items():
        result[key] = FrameworkDescriptor(
            language=data["language"],
            display_name=data["displayName"],
            detection_manifest_file=data["detection"]["manifestFile"],
            detection_manifest_key=data["detection"]["manifestKey"],
            route_style=data["routeStyle"],
            controller_decorators=data.get("controllerDecorators", []),
            service_decorators=data.get("serviceDecorators", []),
            route_decorators=data.get("routeDecorators", []),
            flow_step_decorator=data.get("flowStepDecorator", "flow_step"),
            http_method_map=data.get("httpMethodMap", {}),
            viewset_methods=data.get("viewsetMethods", []),
        )
    return result


# Load once at import time
_DESCRIPTORS = _load_descriptors()


def detect_framework(source_root: str) -> FrameworkDescriptor:
    """
    Detects the Python framework used in source_root by inspecting
    pyproject.toml and requirements.txt for known dependency keys.
    Falls back to FastAPI (most common) if nothing is found.
    """
    dep_text = _read_deps_text(source_root)

    for key in _PY_PRIORITY:
        desc = _DESCRIPTORS.get(key)
        if not desc or desc.language != "python":
            continue
        if desc.detection_manifest_key.lower() in dep_text:
            return desc

    return _DESCRIPTORS["fastapi"]


def _read_deps_text(source_root: str) -> str:
    """Returns a lowercased combined string of all dependency declarations found."""
    parts: list[str] = []

    for fname in ("pyproject.toml", "requirements.txt", "setup.cfg", "setup.py"):
        fpath = os.path.join(source_root, fname)
        if os.path.exists(fpath):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    parts.append(f.read().lower())
            except OSError:
                pass

    return "\n".join(parts)
