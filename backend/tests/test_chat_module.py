import unittest
from typing import Any, List
from fastapi.testclient import TestClient

from src.core.dependencies import get_ai_provider
from src.domain.exceptions import FieldNotFoundError, SessionNotFoundError
from src.infrastructure.in_memory_session_store import InMemorySessionStore
from src.infrastructure.mock_field_repository import MockFieldRepository
from src.main import app
from src.schemas.chat import (
    ChatHistoryItem,
    ChatMessageRequest,
    FieldMockContext,
)
from src.services.agronomist_chat_service import AgronomistChatService


class MockAIChatSession:
    def __init__(self, system_instruction: str) -> None:
        self.system_instruction = system_instruction
        self.history: List[ChatHistoryItem] = []

    def send_message(self, message: str) -> str:
        self.history.append(ChatHistoryItem(role="user", text=message))
        reply = f"Respuesta agronómica simulada para: {message[:30]}..."
        self.history.append(ChatHistoryItem(role="model", text=reply))
        return reply

    def get_history(self) -> List[ChatHistoryItem]:
        return list(self.history)


class FakeAIChatProvider:
    def __init__(self) -> None:
        self.sessions: List[MockAIChatSession] = []
        self.last_system_instruction: str = ""

    def create_session(self, system_instruction: str) -> Any:
        self.last_system_instruction = system_instruction
        session = MockAIChatSession(system_instruction)
        self.sessions.append(session)
        return session

    def send_message(self, chat_session: Any, message: str) -> str:
        return chat_session.send_message(message)

    def get_history(self, chat_session: Any) -> List[ChatHistoryItem]:
        return chat_session.get_history()


class TestModuloChatAgronomico(unittest.TestCase):
    def setUp(self) -> None:
        self.field_repository = MockFieldRepository()
        self.session_store = InMemorySessionStore()
        self.ai_provider = FakeAIChatProvider()
        self.service = AgronomistChatService(
            field_repository=self.field_repository,
            session_store=self.session_store,
            ai_provider=self.ai_provider,
        )

    def test_recuperacion_repositorio_mock(self) -> None:
        plot = self.field_repository.get_field_context("plot-altiplano-01")
        self.assertIsInstance(plot, FieldMockContext)
        self.assertEqual(plot.field_id, "plot-altiplano-01")
        self.assertEqual(plot.soil_moisture_smap.rootzone_deficit_pct, -18.0)
        self.assertEqual(plot.climate_nasa_power.min_temperature_frost_c, -6.2)
        self.assertEqual(len(plot.rotation_strategies), 3)

    def test_parcela_no_encontrada(self) -> None:
        with self.assertRaises(FieldNotFoundError):
            self.field_repository.get_field_context("parcela-inexistente-999")

    def test_operaciones_almacen_sesiones(self) -> None:
        store = InMemorySessionStore()
        session_obj = {"dummy": "chat"}

        self.assertFalse(store.exists("sess-1"))
        self.assertIsNone(store.get("sess-1"))

        store.save("sess-1", session_obj)
        self.assertTrue(store.exists("sess-1"))
        self.assertEqual(store.get("sess-1"), session_obj)

        self.assertTrue(store.delete("sess-1"))
        self.assertFalse(store.exists("sess-1"))
        self.assertFalse(store.delete("sess-1"))

    def test_flujo_nueva_sesion(self) -> None:
        request = ChatMessageRequest(
            field_id="plot-altiplano-01",
            message="¿Qué cultivo me recomiendas para la rotación?",
            drought_simulation=False,
        )

        response = self.service.send_message(request)

        self.assertTrue(response.session_id.startswith("session-"))
        self.assertIn("Respuesta agronómica simulada", response.reply)
        self.assertEqual(response.history_length, 2)
        self.assertIn("Recordatorio agronómico", response.local_validation_reminder)

        system_instr = self.ai_provider.last_system_instruction
        self.assertIn("plot-altiplano-01", system_instr)
        self.assertIn("NASA SMAP", system_instr)
        self.assertIn("-18.0%", system_instr)
        self.assertIn("NASA POWER", system_instr)
        self.assertIn("Rotación Actual", system_instr)
        self.assertIn("Conservación de Agua y Suelo", system_instr)
        self.assertIn("Recuperación de Nutrientes", system_instr)

    def test_continuidad_multi_turno(self) -> None:
        turn1_req = ChatMessageRequest(
            field_id="plot-altiplano-01",
            message="Hola, ¿cómo está la humedad en mi parcela?",
        )
        turn1_res = self.service.send_message(turn1_req)
        session_id = turn1_res.session_id

        turn2_req = ChatMessageRequest(
            session_id=session_id,
            field_id="plot-altiplano-01",
            message="¿Y qué pasa si siembro haba para recuperar nitrógeno?",
        )
        turn2_res = self.service.send_message(turn2_req)

        self.assertEqual(turn2_res.session_id, session_id)
        self.assertEqual(turn2_res.history_length, 4)

        history = self.service.get_chat_history(session_id)
        self.assertEqual(len(history), 4)
        self.assertEqual(history[0].role, "user")
        self.assertIn("cómo está la humedad", history[0].text)

    def test_cierre_de_sesion(self) -> None:
        req = ChatMessageRequest(
            field_id="plot-altiplano-01",
            message="Cerrar sesión de prueba",
        )
        res = self.service.send_message(req)
        session_id = res.session_id

        self.service.close_session(session_id)

        with self.assertRaises(SessionNotFoundError):
            self.service.get_chat_history(session_id)

        with self.assertRaises(SessionNotFoundError):
            self.service.close_session(session_id)

    def test_simulacion_sequia(self) -> None:
        req = ChatMessageRequest(
            field_id="plot-altiplano-01",
            message="¿Cómo actuar ante sequía?",
            drought_simulation=True,
        )
        self.service.send_message(req)

        self.assertIn(
            "ESTADO DE ALERTA: SIMULACIÓN DE SEQUÍA SEVERA ACTIVA",
            self.ai_provider.last_system_instruction,
        )


class TestEndpointsFastAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.fake_provider = FakeAIChatProvider()
        app.dependency_overrides[get_ai_provider] = lambda: self.fake_provider
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_endpoint_salud(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("FieldShift", data["service"])

    def test_mensaje_y_flujo_multi_turno(self) -> None:
        payload_turn1 = {
            "field_id": "plot-altiplano-01",
            "message": "Hola, ¿cuál es el diagnóstico de mi suelo?",
            "drought_simulation": False,
        }
        res1 = self.client.post("/api/v1/chat/message", json=payload_turn1)
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertIn("session_id", data1)
        self.assertIn("reply", data1)
        self.assertEqual(data1["history_length"], 2)
        session_id = data1["session_id"]

        payload_turn2 = {
            "session_id": session_id,
            "field_id": "plot-altiplano-01",
            "message": "¿Qué ventajas tiene la opción de Vicia villosa?",
            "drought_simulation": False,
        }
        res2 = self.client.post("/api/v1/chat/message", json=payload_turn2)
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertEqual(data2["session_id"], session_id)
        self.assertEqual(data2["history_length"], 4)

        res_hist = self.client.get(f"/api/v1/chat/{session_id}/history")
        self.assertEqual(res_hist.status_code, 200)
        history = res_hist.json()
        self.assertEqual(len(history), 4)
        self.assertEqual(history[0]["role"], "user")

        res_del = self.client.delete(f"/api/v1/chat/{session_id}")
        self.assertEqual(res_del.status_code, 200)
        self.assertEqual(res_del.json()["status"], "success")

        res_hist_after = self.client.get(f"/api/v1/chat/{session_id}/history")
        self.assertEqual(res_hist_after.status_code, 404)
        self.assertEqual(res_hist_after.json()["error"], "SessionNotFound")

    def test_parcela_no_encontrada_endpoint(self) -> None:
        payload = {
            "field_id": "parcela-inexistente",
            "message": "Hola",
        }
        response = self.client.post("/api/v1/chat/message", json=payload)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"], "FieldNotFound")


class TestProveedorGemini(unittest.TestCase):
    def test_envio_mensaje_e_historial(self) -> None:
        from unittest.mock import MagicMock
        from src.infrastructure.gemini_chat_provider import GeminiProvider
        from google.genai import types

        mock_client = MagicMock()
        mock_chat = MagicMock()
        mock_client.chats.create.return_value = mock_chat

        mock_response = MagicMock()
        mock_response.text = "Respuesta desde Gemini"
        mock_chat.send_message.return_value = mock_response

        content_user = types.Content(role="user", parts=[types.Part.from_text(text="Pregunta")])
        content_model = types.Content(role="model", parts=[types.Part.from_text(text="Respuesta")])
        mock_chat.get_history.return_value = [content_user, content_model]

        provider = GeminiProvider(client=mock_client, model="gemini-3.1-flash-lite")

        session = provider.create_session("instruccion sistema")
        self.assertEqual(session, mock_chat)

        reply = provider.send_message(session, "Pregunta")
        self.assertEqual(reply, "Respuesta desde Gemini")

        history = provider.get_history(session)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].role, "user")
        self.assertEqual(history[0].text, "Pregunta")
        self.assertEqual(history[1].role, "model")
        self.assertEqual(history[1].text, "Respuesta")


if __name__ == "__main__":
    unittest.main()
