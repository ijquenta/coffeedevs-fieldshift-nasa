import asyncio
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ValidationError

from src.domain.exceptions import AIProviderError
from src.interfaces.ai_chat_provider import ChatProvider
from src.schemas.ine import MunicipioDetalleResponse
from src.schemas.power import (
    PolygonRecommendationRequest,
    PolygonRecommendationResponse,
    PolygonResponse,
)
from src.services.power_service import PowerService


PROMPT_PATH = Path(__file__).resolve().parents[2] / "docs" / "prompt.md"


class _RecommendationContent(BaseModel):
    recommendation: str
    audio_summary: str


class PolygonRecommendationService:
    def __init__(self, power_service: PowerService, chat_provider: ChatProvider):
        self._power_service = power_service
        self._chat_provider = chat_provider

    async def recommend(
        self,
        request: PolygonRecommendationRequest,
        municipality: MunicipioDetalleResponse | None = None,
    ) -> PolygonRecommendationResponse:
        polygon = await self._power_service.polygon(request)
        prompt = PROMPT_PATH.read_text(encoding="utf-8")
        context = self._build_context(request, polygon, municipality)
        raw_reply = await asyncio.to_thread(
            self._generate_reply,
            prompt,
            json.dumps(context, ensure_ascii=False),
        )
        try:
            content = _RecommendationContent.model_validate_json(raw_reply)
        except ValidationError as exc:
            issues = "; ".join(
                f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                for error in exc.errors()
            )
            raise AIProviderError(
                f"Gemini devolvió una salida JSON incompleta o inválida: {issues}"
            ) from exc
        if not content.recommendation.strip() or not content.audio_summary.strip():
            raise AIProviderError(
                "Gemini devolvió campos vacíos para 'recommendation' o 'audio_summary'."
            )
        return PolygonRecommendationResponse(
            polygon=polygon,
            recommendation=content.recommendation,
            audio_summary=content.audio_summary,
        )

    def _generate_reply(self, prompt: str, message: str) -> str:
        session = self._chat_provider.create_session(
            prompt,
            response_json_schema=_RecommendationContent.model_json_schema(),
        )
        return self._chat_provider.send_message(session, message)

    @staticmethod
    def _build_context(
        request: PolygonRecommendationRequest,
        polygon: PolygonResponse,
        municipality: MunicipioDetalleResponse | None,
    ) -> dict[str, Any]:
        location: dict[str, Any] = {
            "municipality_id": request.municipality_id,
            "municipality_name": request.municipality_name,
            "geometry": request.geometry.model_dump(mode="json"),
            "altitude_m": request.site_elevation,
        }
        context: dict[str, Any] = {
            "location": location,
            "period": {
                "start": request.start.isoformat() if request.start else None,
                "end": request.end.isoformat() if request.end else None,
                "resolution": request.temporal.value,
            },
            "nasa_power": polygon.model_dump(mode="json"),
            "plants": request.plants,
            "polygon_request": request.model_dump(mode="json"),
        }
        if request.priorities:
            context["priorities"] = request.priorities
        if request.crop_requirements is not None:
            context["crop_requirements"] = request.crop_requirements
        if request.current_crop:
            context["current_crop"] = request.current_crop
        if municipality is not None:
            location["municipality_name"] = request.municipality_name or municipality.nombre
            context["municipal_crops"] = municipality.cultivos_principales
            context["municipality_data"] = municipality.model_dump(mode="json")
        return context
