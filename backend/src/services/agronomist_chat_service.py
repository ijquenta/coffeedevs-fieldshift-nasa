import uuid
from typing import List

from src.domain.exceptions import SessionNotFoundError
from src.interfaces.ai_chat_provider import ChatProvider
from src.interfaces.chat_session_store import ChatSessionStore
from src.interfaces.field_repository import FieldRepository
from src.schemas.chat import (
    ChatHistoryItem,
    ChatMessageRequest,
    ChatMessageResponse,
    FieldMockContext,
)


class AgronomistChatService:
    """Caso de uso que orquesta el copiloto agronómico multi-turno."""

    LOCAL_VALIDATION_REMINDER = (
        "Recordatorio agronómico: Los análisis satelitales (SMAP, NASA POWER, Sentinel-2, SRTM) "
        "son herramientas de apoyo a escala macro. Valida siempre en terreno con observación directa, "
        "pruebas de humedad del suelo y los saberes tradicionales de tu comunidad."
    )

    def __init__(
        self,
        field_repository: FieldRepository,
        session_store: ChatSessionStore,
        ai_provider: ChatProvider,
    ) -> None:
        self._field_repository = field_repository
        self._session_store = session_store
        self._ai_provider = ai_provider

    def send_message(self, request: ChatMessageRequest) -> ChatMessageResponse:
        session_id = request.session_id
        chat_session = self._session_store.get(session_id) if session_id else None

        if chat_session is None:
            field_context = self._field_repository.get_field_context(request.field_id)
            system_instruction = self._build_system_instruction(
                field=field_context,
                drought_simulation=request.drought_simulation,
            )
            chat_session = self._ai_provider.create_session(system_instruction)
            session_id = session_id or f"session-{uuid.uuid4().hex[:12]}"
            self._session_store.save(session_id, chat_session)

        message_to_send = self._prepare_turn_message(
            message=request.message,
            drought_simulation=request.drought_simulation,
        )

        reply = self._ai_provider.send_message(chat_session, message_to_send)
        history = self._ai_provider.get_history(chat_session)

        return ChatMessageResponse(
            session_id=session_id,
            reply=reply,
            history_length=len(history),
            local_validation_reminder=self.LOCAL_VALIDATION_REMINDER,
        )

    def get_chat_history(self, session_id: str) -> List[ChatHistoryItem]:
        chat_session = self._session_store.get(session_id)
        if chat_session is None:
            raise SessionNotFoundError(session_id)
        return self._ai_provider.get_history(chat_session)

    def close_session(self, session_id: str) -> None:
        deleted = self._session_store.delete(session_id)
        if not deleted:
            raise SessionNotFoundError(session_id)

    def _prepare_turn_message(self, message: str, drought_simulation: bool) -> str:
        if not drought_simulation:
            return message

        return (
            "[ESCENARIO SIMULADO: SEQUÍA EXTREMA ACTIVADA (+2.5°C temp, -30% humedad de suelo SMAP). "
            "Prioriza recomendaciones de choque hídrico y resiliencia inmediata]\n\n"
            f"{message}"
        )

    def _build_system_instruction(
        self,
        field: FieldMockContext,
        drought_simulation: bool,
    ) -> str:
        estrategias_texto = "\n".join(
            [
                f"--- {strat.title} (ID: {strat.id}) ---\n"
                f"- Secuencia de cultivos: {', '.join(strat.crops_cycle)}\n"
                f"- Cobertura y protección de suelo: {strat.soil_cover_improvement}\n"
                f"- Retención y ahorro de agua: {strat.water_retention_impact}\n"
                f"- Balance económico (Inversión vs Retorno): {strat.economic_tradeoff}\n"
                f"- Resiliencia climática estimada: {strat.climate_resilience_rating}"
                for strat in field.rotation_strategies
            ]
        )

        seccion_sequia = ""
        if drought_simulation:
            seccion_sequia = (
                "\n\n*** ESTADO DE ALERTA: SIMULACIÓN DE SEQUÍA SEVERA ACTIVA ***\n"
                "- Humedad de suelo proyectada: Reducción adicional del 30% respecto a los datos satelitales.\n"
                "- Temperatura ambiental: Anomalía térmica de +2.5°C con mayor evapotranspiración.\n"
                "- Instrucción: Descarta cultivos de alto requerimiento hídrico y prioriza coberturas secas (mulch) "
                "o abonos verdes de emergencia."
            )

        return (
            "Eres el 'Copiloto Agronómico FieldShift', un asesor técnico en agricultura regenerativa, "
            "conservación de suelos y adaptación climática, apoyado en datos satelitales de NASA y Copernicus.\n\n"
            "=== REGLAS DE COMUNICACIÓN ===\n"
            "1. Tono cercano, empático, claro y respetuoso con el agricultor.\n"
            "2. Habla en español simple y directo. Explica términos técnicos (ej. 'NDVI' como salud del verde "
            "del cultivo; 'humedad SMAP' como agua disponible en la raíz).\n"
            "3. Explica tradeoffs con franqueza (pros y contras de cada opción: costo vs agua vs heladas).\n"
            "4. Haz preguntas sobre los recursos del productor (riego disponible, ganado, calendario habitual).\n"
            "5. Conserva el contexto multi-turno de las respuestas anteriores del agricultor.\n"
            "6. Recuerda que los datos satelitales son guía macro y deben validarse en campo.\n\n"
            f"=== DATOS DE LA PARCELA ({field.field_id}) ===\n"
            f"- Nombre: {field.name}\n"
            f"- Región: {field.department_or_region}\n"
            f"- Superficie: {field.area_hectares} ha\n\n"
            "1. Humedad del Suelo (NASA SMAP):\n"
            f"   - Humedad superficial: {field.soil_moisture_smap.surface_moisture_m3_m3} m³/m³\n"
            f"   - Anomalía radicular: {field.soil_moisture_smap.rootzone_deficit_pct}%\n"
            f"   - Diagnóstico: {field.soil_moisture_smap.moisture_status}\n\n"
            "2. Clima y Temperatura (NASA POWER):\n"
            f"   - Precipitación anual: {field.climate_nasa_power.annual_precipitation_mm} mm/año\n"
            f"   - Riesgo de heladas: {field.climate_nasa_power.frost_risk_window}\n"
            f"   - Mínima crítica en helada: {field.climate_nasa_power.min_temperature_frost_c} °C\n"
            f"   - Temperatura media: {field.climate_nasa_power.avg_temperature_c} °C\n\n"
            "3. Topografía y Pendiente (NASA SRTM):\n"
            f"   - Altitud: {field.topography_srtm.elevation_masl} m.s.n.m.\n"
            f"   - Pendiente: {field.topography_srtm.slope_pct}%\n"
            f"   - Riesgo de erosión: {field.topography_srtm.erosion_risk}\n\n"
            "4. Cobertura Vegetal y Suelo Expuesto (Sentinel-2):\n"
            f"   - NDVI actual: {field.vegetation_sentinel2.ndvi_current}\n"
            f"   - Meses con suelo desnudo: {', '.join(field.vegetation_sentinel2.bare_soil_months)}\n"
            f"   - Cobertura estimada: {field.vegetation_sentinel2.canopy_coverage_pct}%\n\n"
            "=== ESTRATEGIAS DE ROTACIÓN COMPARADAS ===\n"
            f"{estrategias_texto}"
            f"{seccion_sequia}"
        )
