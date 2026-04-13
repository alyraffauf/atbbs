"""Simple in-memory cache with TTL."""

import time


class TTLCache:
    def __init__(self, ttl_seconds: float):
        self._ttl = ttl_seconds
        self._entries: dict[str, tuple[object, float]] = {}

    def get(self, key: str):
        entry = self._entries.get(key)
        if entry is None:
            return None
        value, expires = entry
        if time.monotonic() > expires:
            del self._entries[key]
            return None
        return value

    def set(self, key: str, value):
        self._entries[key] = (value, time.monotonic() + self._ttl)

    def clear(self):
        self._entries.clear()
