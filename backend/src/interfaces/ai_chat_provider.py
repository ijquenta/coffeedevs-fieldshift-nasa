from typing import Any, List, Protocol

from src.schemas.chat import ChatHistoryItem


class ChatProvider(Protocol):
    """Contrato mínimo que debe cumplir cualquier proveedor de IA."""

    def create_session(
        self,
        system_instruction: str,
        response_json_schema: dict[str, Any] | None = None,
    ) -> Any: ...

    def send_message(self, chat_session: Any, message: str) -> str: ...

    def get_history(self, chat_session: Any) -> List[ChatHistoryItem]: ...
