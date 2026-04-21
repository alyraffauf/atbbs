"""Shared AT Protocol apps list — used by both the TUI and the web frontend."""

import json
import random
from pathlib import Path

_JSON_PATH = Path(__file__).parent / "atproto_apps.json"

ATPROTO_APPS: list[dict[str, str]] = json.loads(_JSON_PATH.read_text())


def pick_random_apps(count: int) -> list[dict[str, str]]:
    return random.sample(ATPROTO_APPS, count)
