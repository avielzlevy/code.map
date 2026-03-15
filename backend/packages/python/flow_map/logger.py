import sys
import json
from datetime import datetime, timezone
from typing import Any, Optional


class FlowLogger:
    @staticmethod
    def _emit(level: str, context: str, message: str, meta: Optional[dict[str, Any]] = None) -> None:
        entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level.upper(),
            "context": context,
            "message": message,
        }
        if meta:
            entry["meta"] = meta

        line = json.dumps(entry)
        stream = sys.stderr if level == "error" else sys.stdout
        stream.write(f"{line}\n")
        stream.flush()

    @classmethod
    def info(cls, context: str, message: str, meta: Optional[dict[str, Any]] = None) -> None:
        cls._emit("info", context, message, meta)

    @classmethod
    def warn(cls, context: str, message: str, meta: Optional[dict[str, Any]] = None) -> None:
        cls._emit("warn", context, message, meta)

    @classmethod
    def error(cls, context: str, message: str, meta: Optional[dict[str, Any]] = None) -> None:
        cls._emit("error", context, message, meta)

    @classmethod
    def debug(cls, context: str, message: str, meta: Optional[dict[str, Any]] = None) -> None:
        cls._emit("debug", context, message, meta)
