from pydantic import BaseModel, Field

from src.schemas.power import PolygonResponse
from src.schemas.soil import SoilPolygonResponse


class PolygonRecommendationResponse(BaseModel):
    polygon: PolygonResponse
    soil: SoilPolygonResponse
    recommendation: str = Field(description="Evaluación agrícola detallada en Markdown")
    audio_summary: str = Field(description="Resumen breve en español sencillo, listo para voz")
