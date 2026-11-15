from datetime import date, timedelta

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
from src.services.reverse_geocoding_service import (
    ReverseGeocodingError,
    ReverseGeocodingService,
)

router = APIRouter(prefix="/api/power", tags=["NASA POWER"])


def get_service(request: Request) -> PowerService:
    return request.app.state.power_service


def get_reverse_geocoding_service() -> ReverseGeocodingService:
    return ReverseGeocodingService()


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
    reverse_geocoding: ReverseGeocodingService = Depends(get_reverse_geocoding_service),
):
    print("[Yanapiri][Recommendation] Request recibido", {
        "temporal": req.temporal,
        "start": req.start,
        "end": req.end,
        "municipality_id": req.municipality_id,
        "municipality_name": req.municipality_name,
        "plants": req.plants,
    })
    requested_start = req.requested_start or req.start
    requested_end = req.requested_end or req.end
    available_end = date.today() - timedelta(days=3)
    if req.start and req.end and req.end > available_end:
        req.start = available_end - timedelta(days=30)
        req.end = available_end
    req.requested_start = requested_start
    req.requested_end = requested_end
    print(
        "[Yanapiri][Recommendation] Periodos separados",
        {"planting_start": requested_start, "planting_end": requested_end, "nasa_start": req.start, "nasa_end": req.end},
    )
    municipality = None
    department_name = None
    municipality_lookup = (
        str(req.municipality_id)
        if req.municipality_id is not None
        else req.municipality_name
    )
    if req.municipality_id is None:
        coordinates = req.geometry.coordinates[0]
        open_ring = coordinates[:-1] or coordinates
        latitude = sum(point[1] for point in open_ring) / len(open_ring)
        longitude = sum(point[0] for point in open_ring) / len(open_ring)
        try:
            location = await reverse_geocoding.reverse(latitude, longitude)
        except ReverseGeocodingError as exc:
            print("[Yanapiri][Recommendation] Error reverse geocoding", str(exc))
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        print(
            "[Yanapiri][Recommendation] Reverse geocoding completado",
            {
                "municipality_name": location.municipality_name,
                "department_name": location.department_name,
                "country_code": location.country_code,
            },
        )
        department_name = location.department_name
        req.municipality_name = location.municipality_name
        if (
            location.country_code == "bo"
            and location.municipality_name
            and location.department_name
            and "paz" in location.department_name.casefold()
        ):
            municipality = ine_service.get_municipio(location.municipality_name)
    elif municipality_lookup is not None:
        municipality = ine_service.get_municipio(str(municipality_lookup))
        if req.municipality_id is not None and municipality is None:
            raise HTTPException(
                status_code=404,
                detail=f"No se encontró el municipio '{req.municipality_id}' en La Paz",
            )
    recommendation_service = PolygonRecommendationService(svc, chat_provider)
    if municipality is not None and department_name is None:
        department_name = "La Paz"
    try:
        response = await recommendation_service.recommend(req, municipality, department_name)
        print("[Yanapiri][Recommendation] Recomendación completada")
        return response
    except Exception as exc:
        print("[Yanapiri][Recommendation] Error generando recomendación", repr(exc))
        raise
