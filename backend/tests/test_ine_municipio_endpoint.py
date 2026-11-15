import unittest
from urllib.parse import quote

from fastapi.testclient import TestClient

from src.main import app


class TestMunicipioPorNombreEndpoint(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.base_path = "/api/v1/ine/la-paz/municipios"

    def test_nombre_url_encoded_retorna_el_mismo_detalle_que_el_id(self) -> None:
        municipio_por_id = self.client.get(f"{self.base_path}/1")
        self.assertEqual(municipio_por_id.status_code, 200, municipio_por_id.text)

        nombre = municipio_por_id.json()["nombre"]
        nombre_codificado = quote(nombre.upper(), safe="")
        response = self.client.get(
            f"{self.base_path}/nombre/{nombre_codificado}"
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), municipio_por_id.json())

    def test_nombre_inexistente_retorna_404(self) -> None:
        response = self.client.get(
            f"{self.base_path}/nombre/{quote('municipio inexistente', safe='')}"
        )

        self.assertEqual(response.status_code, 404)
        self.assertIn("municipio inexistente", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
