"""Simple in-memory cache with TTL."""

import time


class TTLCache:
    def __init__(self, ttl_seconds: float, max_entries: int = 1_000):
        self._ttl = ttl_seconds
        self._max_entries = max_entries
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
        now = time.monotonic()
        self._entries = {
            entry_key: entry
            for entry_key, entry in self._entries.items()
            if entry[1] > now
        }
        if key not in self._entries and len(self._entries) >= self._max_entries:
            oldest_key = min(self._entries, key=lambda item: self._entries[item][1])
            del self._entries[oldest_key]
        self._entries[key] = (value, now + self._ttl)

    def clear(self):
        self._entries.clear()
