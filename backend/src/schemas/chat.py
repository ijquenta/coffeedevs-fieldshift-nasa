from typing import List, Optional
from pydantic import BaseModel, Field


class SoilMoistureSMAP(BaseModel):
    """Métricas de humedad de suelo derivadas de NASA SMAP."""

    surface_moisture_m3_m3: float = Field(
        ...,
        description="Humedad volumétrica superficial en m³/m³",
        examples=[0.14],
    )
    rootzone_deficit_pct: float = Field(
        ...,
        description="Anomalía de humedad en zona radicular respecto a la media histórica (%)",
        examples=[-18.0],
    )
    moisture_status: str = Field(
        ...,
        description="Diagnóstico cualitativo del estado hídrico del suelo",
        examples=["Déficit hídrico estacional moderado-severo en zona radicular"],
    )


class ClimateNasaPower(BaseModel):
    """Condiciones agrometeorológicas derivadas de NASA POWER."""

    annual_precipitation_mm: float = Field(
        ...,
        description="Precipitación anual acumulada en milímetros",
        examples=[480.0],
    )
    frost_risk_window: str = Field(
        ...,
        description="Ventana estacional con riesgo de heladas",
        examples=["Mayo a Agosto"],
    )
    min_temperature_frost_c: float = Field(
        ...,
        description="Temperatura mínima crítica registrada en °C",
        examples=[-6.2],
    )
    avg_temperature_c: float = Field(
        ...,
        description="Temperatura media anual en °C",
        examples=[9.8],
    )


class TopographySRTM(BaseModel):
    """Métricas de altitud y pendiente derivadas de NASA SRTM."""

    elevation_masl: float = Field(
        ...,
        description="Altitud en metros sobre el nivel del mar",
        examples=[3820.0],
    )
    slope_pct: float = Field(
        ...,
        description="Porcentaje de inclinación de la pendiente",
        examples=[6.0],
    )
    erosion_risk: str = Field(
        ...,
        description="Riesgo de erosión por pendiente y viento",
        examples=["Moderado por pendiente e impacto eólico"],
    )


class VegetationSentinel2(BaseModel):
    """Índice de vegetación y suelo desnudo de Copernicus Sentinel-2."""

    ndvi_current: float = Field(
        ...,
        description="Índice de vegetación de diferencia normalizada (0.0 a 1.0)",
        examples=[0.18],
    )
    bare_soil_months: List[str] = Field(
        ...,
        description="Meses con persistencia de suelo desnudo o desprotegido",
        examples=["Agosto", "Septiembre", "Octubre"],
    )
    canopy_coverage_pct: float = Field(
        ...,
        description="Porcentaje estimado de cobertura vegetal foliar",
        examples=[14.5],
    )


class RotationStrategy(BaseModel):
    """Estrategia de rotación de cultivos con evaluación de tradeoffs."""

    id: str = Field(..., description="Identificador único de la estrategia")
    title: str = Field(..., description="Título de la estrategia")
    crops_cycle: List[str] = Field(..., description="Secuencia de cultivos por campaña")
    soil_cover_improvement: str = Field(
        ...,
        description="Impacto en cobertura y protección del suelo",
    )
    water_retention_impact: str = Field(
        ...,
        description="Impacto en retención de agua y humedad",
    )
    economic_tradeoff: str = Field(
        ...,
        description="Relación entre inversión inicial y retorno financiero",
    )
    climate_resilience_rating: str = Field(
        ...,
        description="Nivel de resiliencia ante sequías y heladas",
    )


class FieldMockContext(BaseModel):
    """Contexto satelital y agronómico consolidado de la parcela."""

    field_id: str = Field(..., description="Identificador único de la parcela")
    name: str = Field(..., description="Nombre local de la parcela")
    department_or_region: str = Field(..., description="Ubicación geográfica")
    area_hectares: float = Field(..., description="Superficie cultivada en hectáreas")
    soil_moisture_smap: SoilMoistureSMAP
    climate_nasa_power: ClimateNasaPower
    topography_srtm: TopographySRTM
    vegetation_sentinel2: VegetationSentinel2
    rotation_strategies: List[RotationStrategy]


class ChatMessageRequest(BaseModel):
    """Carga útil para enviar una consulta al copiloto agronómico."""

    session_id: Optional[str] = Field(
        default=None,
        description="ID de sesión activa. Si se omite o expiró, se crea una nueva.",
        examples=["session-4a7b9c1d"],
    )
    field_id: str = Field(
        ...,
        description="Identificador de la parcela a consultar.",
        examples=["plot-altiplano-01"],
    )
    message: str = Field(
        ...,
        description="Pregunta o consulta del agricultor.",
        examples=["¿Qué cultivo me recomiendas para evitar que el suelo quede expuesto en agosto?"],
    )
    drought_simulation: bool = Field(
        default=False,
        description="Simular escenario de sequía extrema (-30% humedad, +2.5°C temperatura).",
    )


class ChatHistoryItem(BaseModel):
    """Representación de un turno en el historial conversacional."""

    role: str = Field(..., description="Rol del emisor ('user' o 'model')", examples=["user"])
    text: str = Field(..., description="Texto del mensaje")


class ChatMessageResponse(BaseModel):
    """Respuesta generada por el copiloto agronómico."""

    session_id: str = Field(..., description="Identificador de la sesión de chat")
    reply: str = Field(..., description="Respuesta del copiloto agronómico")
    history_length: int = Field(
        ...,
        description="Cantidad de turnos guardados en la memoria de la sesión",
        examples=[2],
    )
    local_validation_reminder: str = Field(
        ...,
        description="Aviso de validación local y en terreno de datos satelitales",
    )
