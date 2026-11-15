import unittest
from urllib.parse import quote

from fastapi.testclient import TestClient

from src.main import app


class TestListadoCultivosEndpoint(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.base_path = "/api/v1/ine/la-paz/cultivos"

    def test_listado_general_incluye_los_mismos_objetos_que_la_busqueda_individual(self) -> None:
        response = self.client.get(self.base_path)

        self.assertEqual(response.status_code, 200, response.text)
        cultivos = response.json()
        self.assertIsInstance(cultivos, list)
        self.assertTrue(cultivos)
        self.assertEqual(set(cultivos[0]), {"id", "nombre", "municipios"})

        nombre = quote(cultivos[0]["nombre"], safe="")
        individual = self.client.get(f"{self.base_path}/{nombre}")

        self.assertEqual(individual.status_code, 200, individual.text)
        self.assertIn(individual.json(), cultivos)


if __name__ == "__main__":
    unittest.main()
