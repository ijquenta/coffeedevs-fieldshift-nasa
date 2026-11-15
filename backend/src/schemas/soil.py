from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# power.py no expone actualmente los nombres GeoJSONPolygon ni los modelos de
# resultado usados por este contrato. Se conserva GeoPolygon como el tipo
# GeoJSON compartido y se mantienen aquí los modelos de salida del módulo.
from src.schemas.power import GeoPolygon as GeoJSONPolygon


class ParameterMeta(BaseModel):
    units: str
    longname: str


class ParameterSummary(BaseModel):
    min: float | None
    max: float | None
    mean: float | None
    count: int


class PointResultItem(BaseModel):
    latitude: float
    longitude: float
    parameters: dict[str, ParameterMeta]
    data: dict[str, dict[str, float | None]]


class PointErrorItem(BaseModel):
    latitude: float
    longitude: float
    detail: Any


class SoilPolygonRequest(BaseModel):
    geometry: GeoJSONPolygon
    temporal: Literal["daily", "monthly"] = "daily"
    start: str
    end: str
    parameters: list[str] = Field(default_factory=list)
    presets: list[Literal["soil", "moisture", "temperature"]] = Field(
        default_factory=list
    )
    grid_step: float = Field(default=0.1, ge=0.05, le=5.0)
    include_points: bool = False

    @field_validator("start", "end")
    @classmethod
    def _valid_date(cls, value: str) -> str:
        date.fromisoformat(value)
        return value

    @model_validator(mode="after")
    def _check_dates_and_parameters(self):
        if not self.parameters and not self.presets:
            raise ValueError("Indique 'parameters' o 'presets'")
        if date.fromisoformat(self.start) > date.fromisoformat(self.end):
            raise ValueError("'start' debe ser menor o igual que 'end'")
        return self


class SoilPolygonResponse(BaseModel):
    query: dict[str, Any]
    points_requested: int
    points_ok: int
    parameters: dict[str, ParameterMeta]
    aggregated: dict[str, dict[str, float | None]]
    summary: dict[str, ParameterSummary]
    points: list[PointResultItem] | None = None
    errors: list[PointErrorItem] = Field(default_factory=list)
