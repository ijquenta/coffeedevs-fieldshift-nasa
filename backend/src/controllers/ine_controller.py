from fastapi import APIRouter, Depends, HTTPException, Query

from src.schemas.ine import (
    CultivoMunicipiosResponse,
    MunicipioDetalleResponse,
    MunicipioLaPaz,
)
from src.services.ine_service import INEService


router = APIRouter(prefix="/api/v1/ine/la-paz", tags=["INE Bolivia - La Paz"])
service = INEService()


def get_service() -> INEService:
    return service


@router.get("/municipios", response_model=list[MunicipioLaPaz])
async def municipios(
    piso_ecologico: str | None = Query(default=None),
    solo_altiplano_valles: bool = Query(default=False),
    cultivo: str | None = Query(default=None, description="Ej. Papa, Maíz, Haba"),
    svc: INEService = Depends(get_service),
):
    return svc.list_municipios(piso_ecologico, solo_altiplano_valles, cultivo)


@router.get("/municipios/{municipio_id}", response_model=MunicipioDetalleResponse)
async def municipio(municipio_id: str, svc: INEService = Depends(get_service)):
    result = svc.get_municipio(municipio_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No se encontró el municipio '{municipio_id}' en La Paz")
    return result


@router.get(
    "/municipios/nombre/{nombre_municipio}",
    response_model=MunicipioDetalleResponse,
    summary="Obtener municipio por nombre",
)
async def municipio_por_nombre(
    nombre_municipio: str,
    svc: INEService = Depends(get_service),
):
    result = svc.get_municipio(nombre_municipio)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró el municipio '{nombre_municipio}' en La Paz",
        )
    return result


@router.get(
    "/cultivos",
    response_model=list[CultivoMunicipiosResponse],
    summary="Listar cultivos registrados por municipio",
)
async def cultivos(svc: INEService = Depends(get_service)):
    return svc.list_cultivos_municipios()


@router.get("/cultivos/{cultivo}", response_model=CultivoMunicipiosResponse)
async def cultivo(cultivo: str, svc: INEService = Depends(get_service)):
    result = svc.get_cultivo_municipios(cultivo)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No se encontró el cultivo '{cultivo}' en La Paz")
    return result


