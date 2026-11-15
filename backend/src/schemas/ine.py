from typing import Literal

from pydantic import BaseModel, Field


class CultivoResumenItem(BaseModel):
    id: str
    nombre: str
    categoria: str
    viable_invierno: bool
    promedio_rendimiento_verano_kgha: float | None = None
    ultima_superficie_verano_ha: float | None = None
    ultima_superficie_invierno_ha: float | None = None


class MunicipioLaPaz(BaseModel):
    id: int
    nombre: str
    provincia: str
    piso_ecologico: str
    latitude: float
    longitude: float
    cultivos_principales: list[str]


class MunicipioDetalleResponse(MunicipioLaPaz):
    cultivos_detalle: list[CultivoResumenItem] = Field(default_factory=list)


class CultivoMunicipiosResponse(BaseModel):
    id: int
    nombre: str
    municipios: list[str]


class CampanaDetalle(BaseModel):
    rendimiento_kgha: dict[str, float | None] = Field(default_factory=dict)
    produccion_ton: dict[str, float | None] = Field(default_factory=dict)
    superficie_ha: dict[str, float | None] = Field(default_factory=dict)
    promedio_rendimiento_ultimos_5_anios: float | None = None
    ultima_produccion_ton: float | None = None
    ultima_superficie_ha: float | None = None
    cosecha_estimada_toneladas: float | None = None


class CampanaCultivoResponse(BaseModel):
    id: str
    departamento: str
    fuente: str
    cultivo: str
    categoria: str
    hectareas_evaluadas: float
    viable_invierno: bool
    nivel_adopcion_local: Literal["Alta", "Media", "Nicho", "Sin registro"]
    verano: CampanaDetalle
    invierno: CampanaDetalle
    lectura_agronomica: str
