import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class EnvConfig:
    api_key: Optional[str] = field(default_factory=lambda: os.environ.get("SUMMARIES_API_KEY"))
    provider: Optional[str] = field(default_factory=lambda: os.environ.get("SUMMARIES_PROVIDER"))


env_config = EnvConfig()
