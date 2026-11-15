import json
import unittest
from datetime import date
from typing import Any

from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.dependencies import get_ai_provider
from src.main import app
from src.schemas.power import PolygonRecommendationRequest, PolygonResponse


class FakePowerService:
    def __init__(self) -> None:
        self.request: PolygonRecommendationRequest | None = None

    async def polygon(self, request: PolygonRecommendationRequest) -> PolygonResponse:
        self.request = request
        return PolygonResponse(
            query={
                "temporal": request.temporal.value,
                "start": request.start,
                "end": request.end,
                "parameters": request.parameters,
            },
            points_requested=1,
            points_ok=1,
            parameters={"T2M": {"units": "C"}},
            aggregated={"T2M": {"20240101": 12.5}},
            summary={"T2M": {"min": 12.5, "max": 12.5, "mean": 12.5, "count": 1}},
        )


class FakeAIProvider:
    def __init__(self) -> None:
        self.system_instruction = ""
        self.message: dict[str, Any] | None = None
        self.response_text = json.dumps(
            {
                "recommendation": "## Evaluación\nRecomendación detallada.",
                "audio_summary": "Conviene sembrar con cuidado y vigilar el agua.",
            },
            ensure_ascii=False,
        )

    def create_session(self, system_instruction: str) -> object:
        self.system_instruction = system_instruction
        return object()

    def send_message(self, _chat_session: Any, message: str) -> str:
        self.message = json.loads(message)
        return self.response_text

    def get_history(self, _chat_session: Any) -> list[Any]:
        return []


class TestPolygonRecommendationEndpoint(unittest.TestCase):
    def setUp(self) -> None:
        self.original_power_service = getattr(app.state, "power_service", None)
        self.power_service = FakePowerService()
        app.state.power_service = self.power_service
        self.ai_provider = FakeAIProvider()
        app.dependency_overrides[get_ai_provider] = lambda: self.ai_provider
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        if self.original_power_service is None:
            del app.state.power_service
        else:
            app.state.power_service = self.original_power_service

    def test_sends_polygon_response_dates_and_priorities_to_gemini(self) -> None:
        payload = {
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[-68.2, -16.5], [-68.1, -16.5], [-68.1, -16.4], [-68.2, -16.5]]],
            },
            "temporal": "daily",
            "start": "2024-01-01",
            "end": "2024-01-02",
            "parameters": ["T2M"],
            "plants": ["papa", "haba"],
            "municipality_name": "Municipio de prueba",
            "priorities": "priorizar ahorro de agua",
        }

        response = self.client.post("/api/power/polygon/recommendation", json=payload)

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["recommendation"], "## Evaluación\nRecomendación detallada.")
        self.assertEqual(
            response.json()["audio_summary"],
            "Conviene sembrar con cuidado y vigilar el agua.",
        )
        self.assertEqual(response.json()["polygon"]["aggregated"]["T2M"]["20240101"], 12.5)
        self.assertEqual(self.power_service.request.start, date(2024, 1, 1))
        self.assertEqual(self.ai_provider.message["period"]["resolution"], "daily")
        self.assertEqual(self.ai_provider.message["period"]["start"], "2024-01-01")
        self.assertEqual(self.ai_provider.message["nasa_power"]["aggregated"]["T2M"]["20240101"], 12.5)
        self.assertEqual(self.ai_provider.message["polygon_request"]["geometry"]["type"], "Polygon")
        self.assertEqual(self.ai_provider.message["priorities"], "priorizar ahorro de agua")
        self.assertEqual(self.ai_provider.message["location"]["municipality_name"], "Municipio de prueba")
        self.assertIn("Eres un asistente agrícola especializado", self.ai_provider.system_instruction)

    def test_recommendation_only_accepts_daily_or_hourly(self) -> None:
        with self.assertRaises(ValidationError):
            PolygonRecommendationRequest(
                geometry={
                    "type": "Polygon",
                    "coordinates": [[[-68.2, -16.5], [-68.1, -16.5], [-68.1, -16.4], [-68.2, -16.5]]],
                },
                temporal="monthly",
                start="2024-01-01",
                end="2024-01-02",
                parameters=["T2M"],
                plants=["papa"],
            )

    def test_documented_case_three_sends_all_agronomic_fields_to_gemini(self) -> None:
        payload = {
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[-68.2, -16.5], [-68.1, -16.5], [-68.1, -16.4], [-68.2, -16.5]]],
            },
            "temporal": "daily",
            "start": "2024-03-01",
            "end": "2024-03-03",
            "parameters": ["T2M"],
            "presets": ["precipitation"],
            "plants": ["cebada"],
            "current_crop": "papa",
            "crop_requirements": {
                "cebada": {
                    "source": "Indicar fuente consultada",
                    "variety": "Variedad conocida",
                    "stage": "crecimiento",
                }
            },
            "priorities": "reducir riesgos y costos",
        }

        response = self.client.post("/api/power/polygon/recommendation", json=payload)

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.power_service.request.parameters, ["T2M"])
        self.assertEqual(self.power_service.request.presets, ["precipitation"])
        self.assertEqual(self.ai_provider.message["plants"], ["cebada"])
        self.assertEqual(self.ai_provider.message["current_crop"], "papa")
        self.assertEqual(self.ai_provider.message["crop_requirements"], payload["crop_requirements"])
        self.assertEqual(self.ai_provider.message["priorities"], "reducir riesgos y costos")
        self.assertEqual(self.ai_provider.message["polygon_request"]["start"], "2024-03-01")
        self.assertEqual(self.ai_provider.message["polygon_request"]["parameters"], ["T2M"])
        self.assertEqual(self.ai_provider.message["polygon_request"]["presets"], ["precipitation"])
        self.assertIn("nasa_power", self.ai_provider.message)

    def test_invalid_gemini_output_returns_explicit_error(self) -> None:
        self.ai_provider.response_text = "No es el JSON solicitado"
        payload = {
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[-68.2, -16.5], [-68.1, -16.5], [-68.1, -16.4], [-68.2, -16.5]]],
            },
            "start": "2024-01-01",
            "end": "2024-01-02",
            "parameters": ["T2M"],
            "plants": ["papa"],
        }

        response = self.client.post("/api/power/polygon/recommendation", json=payload)

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"], "AIProviderError")
