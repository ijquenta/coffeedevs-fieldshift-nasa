from datetime import date
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

from src.core.presets import PARAMETER_PRESETS


class Temporal(str, Enum):
    hourly = "hourly"
    daily = "daily"
    monthly = "monthly"
    climatology = "climatology"


class Community(str, Enum):
    ag = "ag"
    re = "re"
    sb = "sb"
    hy = "hy"


class Units(str, Enum):
    metric = "metric"
    imperial = "imperial"


class TimeStandard(str, Enum):
    lst = "lst"
    utc = "utc"


class GeoPolygon(BaseModel):
    """Polígono GeoJSON. Coordenadas en orden [lon, lat]."""

    type: str = "Polygon"
    coordinates: list[list[list[float]]]

    @field_validator("type")
    @classmethod
    def _type(cls, v: str) -> str:
        if v != "Polygon":
            raise ValueError("Solo se admite geometría de tipo Polygon")
        return v

    @model_validator(mode="after")
    def _rings(self):
        if not self.coordinates:
            raise ValueError("El polígono no tiene anillos")
        for ring in self.coordinates:
            if len(ring) < 4:
                raise ValueError("Cada anillo requiere al menos 4 posiciones (cerrado)")
            if ring[0] != ring[-1]:
                ring.append(list(ring[0]))
            for pos in ring:
                lon, lat = pos[0], pos[1]
                if not (-180 <= lon <= 180 and -90 <= lat <= 90):
                    raise ValueError("Coordenada fuera de rango; use el orden [lon, lat]")
        return self


class DataQuery(BaseModel):
    temporal: Temporal = Temporal.daily
    start: date | None = Field(None, description="Fecha inicial (YYYY-MM-DD)")
    end: date | None = Field(None, description="Fecha final (YYYY-MM-DD)")
    community: Community = Community.ag
    parameters: list[str] = Field(default_factory=list)
    presets: list[str] = Field(
        default_factory=list, description=f"Opciones: {', '.join(PARAMETER_PRESETS)}"
    )
    units: Units = Units.metric
    time_standard: TimeStandard = TimeStandard.lst
    site_elevation: float | None = None
    wind_elevation: float | None = None
    wind_surface: str | None = None

    @model_validator(mode="after")
    def _check(self):
        if not self.parameters and not self.presets:
            raise ValueError("Indique 'parameters' o 'presets'")
        unknown = [p for p in self.presets if p not in PARAMETER_PRESETS]
        if unknown:
            raise ValueError(f"Presets desconocidos: {unknown}")
        if self.temporal != Temporal.climatology and (self.start is None or self.end is None):
            raise ValueError("'start' y 'end' son obligatorios para este tipo temporal")
        if self.start and self.end:
            if self.start > self.end:
                raise ValueError("'start' debe ser menor o igual que 'end'")
            if self.temporal == Temporal.daily and self.start < date(1981, 1, 1):
                raise ValueError("Los datos diarios comienzan el 1981-01-01")
            if self.temporal == Temporal.hourly and (self.end - self.start).days > 366:
                raise ValueError("Para datos horarios use rangos de hasta 366 días")
        return self


class PointRequest(DataQuery):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class PolygonRequest(DataQuery):
    geometry: GeoPolygon
    grid_step: float = Field(0.5, ge=0.1, le=5, description="Paso de muestreo en grados")
    include_points: bool = Field(False, description="Incluir la serie de cada punto")


class PolygonRecommendationRequest(PolygonRequest):
    """Consulta NASA POWER del polígono y datos para la recomendación agrícola."""

    plants: list[str] = Field(min_length=1, description="Cultivos que se quieren evaluar")
    municipality_id: int | None = None
    municipality_name: str | None = None
    priorities: str | None = Field(
        None, description="Prioridad libre del agricultor, por ejemplo ahorrar agua o costos"
    )
    crop_requirements: dict[str, Any] | None = None
    current_crop: str | None = None

    @field_validator("temporal")
    @classmethod
    def _daily_or_hourly(cls, value: Temporal) -> Temporal:
        if value not in (Temporal.daily, Temporal.hourly):
            raise ValueError("La recomendación admite únicamente temporal 'daily' o 'hourly'")
        return value

    @field_validator("plants")
    @classmethod
    def _non_empty_plants(cls, value: list[str]) -> list[str]:
        if not any(plant.strip() for plant in value):
            raise ValueError("Indique al menos un cultivo")
        return value


class PointResponse(BaseModel):
    latitude: float
    longitude: float
    elevation: float | None = None
    parameters: dict[str, Any]
    data: dict[str, dict[str, float | None]]


class PolygonResponse(BaseModel):
    query: dict[str, Any]
    points_requested: int
    points_ok: int
    parameters: dict[str, Any]
    aggregated: dict[str, dict[str, float | None]]
    summary: dict[str, dict[str, float | int | None]]
    points: list[PointResponse] | None = None
    errors: list[dict[str, Any]] = Field(default_factory=list)
