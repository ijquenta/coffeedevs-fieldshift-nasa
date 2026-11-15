import time
from typing import Any


class TTLCache:
    def __init__(self, ttl_s: int, max_items: int = 2048):
        self._ttl = ttl_s
        self._max = max_items
        self._store: dict[Any, tuple[float, Any]] = {}

    def get(self, key: Any) -> Any | None:
        item = self._store.get(key)
        if item is None:
            return None
        expires, value = item
        if expires < time.monotonic():
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: Any, value: Any) -> None:
        if len(self._store) >= self._max:
            self._store.pop(next(iter(self._store)))
        self._store[key] = (time.monotonic() + self._ttl, value)
