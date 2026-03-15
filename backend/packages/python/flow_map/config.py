import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class EnvConfig:
    api_key: Optional[str] = field(default_factory=lambda: os.environ.get("FLOW_MAP_API_KEY"))


env_config = EnvConfig()
