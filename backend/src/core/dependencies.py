import os
from functools import lru_cache

from fastapi import Depends
from google import genai

from src.core.config import Settings, get_settings
from src.domain.exceptions import AIProviderError
from src.infrastructure.gemini_chat_provider import GeminiProvider
from src.infrastructure.in_memory_session_store import InMemorySessionStore
from src.infrastructure.mock_field_repository import MockFieldRepository
from src.interfaces.ai_chat_provider import ChatProvider
from src.interfaces.chat_session_store import ChatSessionStore
from src.interfaces.field_repository import FieldRepository
from src.services.agronomist_chat_service import AgronomistChatService

_field_repository = MockFieldRepository()
_session_store = InMemorySessionStore()


def get_field_repository() -> FieldRepository:
    return _field_repository


def get_session_store() -> ChatSessionStore:
    return _session_store


@lru_cache
def get_ai_provider() -> ChatProvider:
    settings: Settings = get_settings()
    api_key = settings.GEMINI_API_KEY.strip() or os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key:
        raise AIProviderError(
            "GEMINI_API_KEY no configurada. Define GEMINI_API_KEY en tu archivo .env o en el entorno."
        )

    return GeminiProvider(
        client=genai.Client(api_key=api_key),
        model=settings.GEMINI_MODEL,
        temperature=settings.GEMINI_TEMPERATURE,
    )


def get_chat_service(
    field_repository: FieldRepository = Depends(get_field_repository),
    session_store: ChatSessionStore = Depends(get_session_store),
    ai_provider: ChatProvider = Depends(get_ai_provider),
) -> AgronomistChatService:
    return AgronomistChatService(
        field_repository=field_repository,
        session_store=session_store,
        ai_provider=ai_provider,
    )
