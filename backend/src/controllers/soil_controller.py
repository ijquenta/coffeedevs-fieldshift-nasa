from fastapi import APIRouter, Depends, HTTPException

from src.core.exceptions import PowerAPIError
from src.schemas.soil import SoilPolygonRequest, SoilPolygonResponse
from src.services.soil_client import SoilClient
from src.services.soil_service import SoilService


router = APIRouter(prefix="/api/soil", tags=["Estudio de Suelo"])
_service = SoilService(SoilClient())


def get_service() -> SoilService:
    return _service


@router.post("/polygon", response_model=SoilPolygonResponse)
async def polygon(req: SoilPolygonRequest, svc: SoilService = Depends(get_service)):
    try:
        return await svc.polygon(req)
    except PowerAPIError as exc:
        status = exc.status_code if exc.status_code in (422, 429, 502, 504) else 502
        raise HTTPException(status_code=status, detail=exc.detail) from exc
