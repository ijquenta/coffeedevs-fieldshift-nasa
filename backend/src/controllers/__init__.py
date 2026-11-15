from fastapi import APIRouter

from src.controllers.chat_controller import router as chat_router

api_router = APIRouter()
api_router.include_router(chat_router)

__all__ = ["api_router", "chat_router"]
