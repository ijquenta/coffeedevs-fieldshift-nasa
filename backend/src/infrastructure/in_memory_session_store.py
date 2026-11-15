import threading
from typing import Any, Dict, Optional


class InMemorySessionStore:
    """Almacén en memoria concurrente para sesiones activas de chat."""

    def __init__(self) -> None:
        self._sessions: Dict[str, Any] = {}
        self._lock = threading.Lock()

    def save(self, session_id: str, session: Any) -> None:
        with self._lock:
            self._sessions[session_id] = session

    def get(self, session_id: str) -> Optional[Any]:
        with self._lock:
            return self._sessions.get(session_id)

    def delete(self, session_id: str) -> bool:
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                return True
            return False

    def exists(self, session_id: str) -> bool:
        with self._lock:
            return session_id in self._sessions

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()
