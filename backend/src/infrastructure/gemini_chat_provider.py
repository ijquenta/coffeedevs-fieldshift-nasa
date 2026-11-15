from typing import Any, List

from google import genai
from google.genai import types

from src.domain.exceptions import AIProviderError
from src.schemas.chat import ChatHistoryItem


class GeminiProvider:
    """Implementación de ChatProvider utilizando el SDK oficial google-genai."""

    def __init__(
        self,
        client: genai.Client,
        model: str = "gemini-3.1-flash-lite",
        temperature: float = 0.3,
    ) -> None:
        self._client = client
        self._model = model
        self._temperature = temperature

    def create_session(self, system_instruction: str) -> Any:
        try:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=self._temperature,
            )
            return self._client.chats.create(
                model=self._model,
                config=config,
            )
        except Exception as exc:
            raise AIProviderError(f"No se pudo crear la sesión con Gemini: {str(exc)}") from exc

    def send_message(self, chat_session: Any, message: str) -> str:
        try:
            response = chat_session.send_message(message)
            if not response or response.text is None:
                raise AIProviderError("Gemini retornó una respuesta vacía o bloqueada.")
            return response.text
        except AIProviderError:
            raise
        except Exception as exc:
            raise AIProviderError(f"Error de comunicación con Gemini: {str(exc)}") from exc

    def get_history(self, chat_session: Any) -> List[ChatHistoryItem]:
        try:
            raw_history = chat_session.get_history()
            items: List[ChatHistoryItem] = []

            for content in raw_history:
                role = content.role or "assistant"
                segmentos: List[str] = []

                if content.parts:
                    for part in content.parts:
                        if hasattr(part, "text") and part.text:
                            segmentos.append(part.text)

                items.append(
                    ChatHistoryItem(
                        role=role,
                        text="".join(segmentos),
                    )
                )

            return items
        except Exception as exc:
            raise AIProviderError(f"Error al obtener historial de Gemini: {str(exc)}") from exc
