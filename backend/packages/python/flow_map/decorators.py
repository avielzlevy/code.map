from typing import Callable

from .constants import FLOW_STEP_ATTR


def flow_step(description: str) -> Callable:
    """
    Marks a method as a named flow step with a human-readable business intent label.
    The description overrides the raw function name in the flow graph visualization.

    Example::

        @flow_step("Validate credentials and issue access token")
        async def login(self, dto: LoginDto) -> TokenResponse:
            ...
    """
    def decorator(func: Callable) -> Callable:
        setattr(func, FLOW_STEP_ATTR, description)
        return func

    return decorator
