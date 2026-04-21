"""Shared AT Protocol apps list — used by both the TUI and the web frontend."""

import random

from core.shared import ATPROTO_APPS

__all__ = ["ATPROTO_APPS", "pick_random_apps"]


def pick_random_apps(count: int) -> list[dict[str, str]]:
    return random.sample(ATPROTO_APPS, count)
