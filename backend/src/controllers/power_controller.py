from fastapi import APIRouter, Depends, HTTPException, Request

from src.controllers.ine_controller import get_service as get_ine_service
from src.core.dependencies import get_ai_provider
from src.interfaces.ai_chat_provider import ChatProvider
from src.schemas.power import (
    PointRequest,
    PointResponse,
    PolygonRecommendationRequest,
    PolygonRecommendationResponse,
    PolygonRequest,
    PolygonResponse,
)
from src.services.ine_service import INEService
from src.services.polygon_recommendation_service import PolygonRecommendationService
from src.services.power_service import PowerService

router = APIRouter(prefix="/api/power", tags=["NASA POWER"])


def get_service(request: Request) -> PowerService:
    return request.app.state.power_service


@router.get("/presets", summary="Grupos de parámetros disponibles")
async def presets(svc: PowerService = Depends(get_service)):
    return svc.presets()


@router.post("/point", response_model=PointResponse, summary="Serie de un punto")
async def point(req: PointRequest, svc: PowerService = Depends(get_service)):
    return await svc.point(req)


@router.post(
    "/polygon",
    response_model=PolygonResponse,
    summary="Serie agregada de un polígono (GeoJSON)",
)
async def polygon(req: PolygonRequest, svc: PowerService = Depends(get_service)):
    return await svc.polygon(req)


@router.post(
    "/polygon/recommendation",
    response_model=PolygonRecommendationResponse,
    summary="Analizar un polígono y recomendar cultivos con Gemini",
)
async def polygon_recommendation(
    req: PolygonRecommendationRequest,
    svc: PowerService = Depends(get_service),
    chat_provider: ChatProvider = Depends(get_ai_provider),
    ine_service: INEService = Depends(get_ine_service),
):
    municipality = None
    municipality_lookup = (
        str(req.municipality_id)
        if req.municipality_id is not None
        else req.municipality_name
    )
    if municipality_lookup is not None:
        municipality = ine_service.get_municipio(str(municipality_lookup))
        if req.municipality_id is not None and municipality is None:
            raise HTTPException(
                status_code=404,
                detail=f"No se encontró el municipio '{req.municipality_id}' en La Paz",
            )

    recommendation_service = PolygonRecommendationService(svc, chat_provider)
    return await recommendation_service.recommend(req, municipality)
