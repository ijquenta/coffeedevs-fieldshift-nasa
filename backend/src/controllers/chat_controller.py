from typing import Any, Dict, List

from fastapi import APIRouter, Depends, status

from src.core.dependencies import get_chat_service
from src.schemas.chat import ChatHistoryItem, ChatMessageRequest, ChatMessageResponse
from src.services.agronomist_chat_service import AgronomistChatService

router = APIRouter(prefix="/chat", tags=["Chat Agronómico"])


@router.post(
    "/message",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Enviar mensaje al copiloto agronómico",
    description="Envía una consulta. Si no se provee session_id o expiró, inicializa una nueva sesión con datos satelitales.",
)
def send_chat_message(
    payload: ChatMessageRequest,
    chat_service: AgronomistChatService = Depends(get_chat_service),
) -> ChatMessageResponse:
    return chat_service.send_message(payload)


@router.get(
    "/{session_id}/history",
    response_model=List[ChatHistoryItem],
    status_code=status.HTTP_200_OK,
    summary="Obtener historial de la sesión",
    description="Retorna la lista de turnos (usuario y asistente) guardados en la sesión activa.",
)
def get_session_history(
    session_id: str,
    chat_service: AgronomistChatService = Depends(get_chat_service),
) -> List[ChatHistoryItem]:
    return chat_service.get_chat_history(session_id)


@router.delete(
    "/{session_id}",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Finalizar y limpiar sesión",
    description="Elimina la sesión de la memoria activa y libera los recursos del hilo conversacional.",
)
def close_chat_session(
    session_id: str,
    chat_service: AgronomistChatService = Depends(get_chat_service),
) -> Dict[str, Any]:
    chat_service.close_session(session_id)
    return {
        "status": "success",
        "session_id": session_id,
        "message": "Sesión de chat finalizada y eliminada con éxito.",
    }
