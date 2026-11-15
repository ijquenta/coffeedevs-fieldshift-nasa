from fastapi import APIRouter, Depends, Request

from src.schemas.power import PointRequest, PointResponse, PolygonRequest, PolygonResponse
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
