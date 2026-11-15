import json
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

from src.schemas.ine import (
    CampanaCultivoResponse,
    CampanaDetalle,
    CultivoResumenItem,
    MunicipioDetalleResponse,
    MunicipioLaPaz,
)


INE_DIR = Path(__file__).resolve().parents[2] / "data" / "ine"
INE_PATH = INE_DIR / "lapaz_ine_resumen.json"
MUNICIPIOS_PATH = INE_DIR / "municipios_la_paz.json"
MUNICIPIOS_LEGACY_PATH = INE_DIR / "municipios_la_pazTodos.json"


def _normalizar(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(char for char in decomposed if not unicodedata.combining(char)).casefold().strip()


@lru_cache(maxsize=1)
def _load_ine_data() -> dict[str, Any]:
    with INE_PATH.open("r", encoding="utf-8-sig") as file:
        return json.load(file)


@lru_cache(maxsize=1)
def _load_municipios_data() -> dict[str, Any]:
    path = MUNICIPIOS_PATH if MUNICIPIOS_PATH.exists() else MUNICIPIOS_LEGACY_PATH
    with path.open("r", encoding="utf-8-sig") as file:
        return json.load(file)


def _campana(data: dict[str, Any], hectareas: float) -> CampanaDetalle:
    promedio = data.get("promedio_rendimiento_ultimos_5_anios")
    cosecha = round((promedio * hectareas) / 1000, 2) if promedio is not None else None
    return CampanaDetalle(
        rendimiento_kgha=data.get("rendimiento_kgha") or {},
        produccion_ton=data.get("produccion_ton") or {},
        superficie_ha=data.get("superficie_ha") or {},
        promedio_rendimiento_ultimos_5_anios=promedio,
        ultima_produccion_ton=data.get("ultima_produccion_ton"),
        ultima_superficie_ha=data.get("ultima_superficie_ha"),
        cosecha_estimada_toneladas=cosecha,
    )


class INEService:
    def list_municipios(
        self,
        piso_ecologico: str | None = None,
        solo_altiplano_valles: bool = False,
    ) -> list[MunicipioLaPaz]:
        result: list[MunicipioLaPaz] = []
        for item in _load_municipios_data()["municipios"]:
            piso = item["piso_ecologico"]
            if solo_altiplano_valles and _normalizar(piso) == _normalizar("Yungas / Amazonía"):
                continue
            if piso_ecologico and _normalizar(piso_ecologico) not in _normalizar(piso):
                continue
            result.append(MunicipioLaPaz.model_validate(item))
        return result

    def get_municipio(self, municipio_id_o_nombre: str) -> MunicipioDetalleResponse | None:
        query = _normalizar(municipio_id_o_nombre)
        municipality = next(
            (
                item
                for item in _load_municipios_data()["municipios"]
                if str(item["id"]) == municipio_id_o_nombre
                or _normalizar(item["nombre"]) == query
            ),
            None,
        )
        if municipality is None:
            return None

        try:
            summary = _load_ine_data()["cultivos"]
        except FileNotFoundError:
            return MunicipioDetalleResponse(**municipality, cultivos_detalle=[])
        normalized = {_normalizar(name): (name, data) for name, data in summary.items()}
        details: list[CultivoResumenItem] = []
        for crop_name in municipality.get("cultivos_principales", []):
            crop_data = summary.get(crop_name)
            if crop_data is None:
                matched = normalized.get(_normalizar(crop_name))
                if matched:
                    crop_name, crop_data = matched
            if crop_data is None:
                continue
            details.append(self._cultivo_resumen(crop_name, crop_data))
        return MunicipioDetalleResponse(**municipality, cultivos_detalle=details)

    @staticmethod
    def _cultivo_resumen(name: str, data: dict[str, Any]) -> CultivoResumenItem:
        verano = data.get("verano") or {}
        invierno = data.get("invierno") or {}
        return CultivoResumenItem(
            id=data["id"],
            nombre=name,
            categoria=data["categoria"],
            viable_invierno=(invierno.get("ultima_superficie_ha") or 0) > 0
            or data["categoria"] == "Forrajes",
            promedio_rendimiento_verano_kgha=verano.get("promedio_rendimiento_ultimos_5_anios"),
            ultima_superficie_verano_ha=verano.get("ultima_superficie_ha"),
            ultima_superficie_invierno_ha=invierno.get("ultima_superficie_ha"),
        )

    def list_cultivos(self, categoria: str | None = None) -> list[CultivoResumenItem]:
        result = []
        for name, data in _load_ine_data()["cultivos"].items():
            if categoria and _normalizar(categoria) not in _normalizar(data["categoria"]):
                continue
            result.append(self._cultivo_resumen(name, data))
        return result

    def _resolve_cultivo(self, cultivo: str) -> tuple[str, dict[str, Any]] | None:
        data = _load_ine_data()["cultivos"]
        if cultivo in data:
            return cultivo, data[cultivo]
        for name, item in data.items():
            if item["id"] == cultivo or _normalizar(name) == _normalizar(cultivo):
                return name, item
        aliases = {"maiz": "Maíz en grano", "haba": "Haba verde", "cebada": "Cebada en grano"}
        alias = aliases.get(_normalizar(cultivo))
        if alias and alias in data:
            return alias, data[alias]
        query = _normalizar(cultivo)
        return next(
            ((name, item) for name, item in data.items() if query and query in _normalizar(name)),
            None,
        )

    def get_cultivo_campanas(
        self, cultivo: str, hectareas: float = 1.0
    ) -> CampanaCultivoResponse | None:
        resolved = self._resolve_cultivo(cultivo)
        if resolved is None:
            return None
        name, data = resolved
        verano = _campana(data.get("verano") or {}, hectareas)
        invierno = _campana(data.get("invierno") or {}, hectareas)
        surface_total = (verano.ultima_superficie_ha or 0) + (invierno.ultima_superficie_ha or 0)
        viable_invierno = (invierno.ultima_superficie_ha or 0) > 0 or data["categoria"] == "Forrajes"
        if surface_total >= 5000:
            adoption = "Alta"
        elif surface_total >= 500:
            adoption = "Media"
        elif surface_total > 0:
            adoption = "Nicho"
        else:
            adoption = "Sin registro"

        rendimiento = verano.promedio_rendimiento_ultimos_5_anios
        rendimiento_text = (
            f"El rendimiento promedio de verano es {rendimiento:g} kg/ha."
            if rendimiento is not None
            else "No hay rendimiento promedio de verano registrado."
        )
        cosecha_text = (
            f"Para {hectareas:g} hectáreas se estiman {verano.cosecha_estimada_toneladas:g} toneladas en verano."
            if verano.cosecha_estimada_toneladas is not None
            else "No se puede estimar la cosecha de verano por falta de rendimiento."
        )
        if verano.ultima_superficie_ha and invierno.ultima_superficie_ha:
            cycle = "Tiene registro en verano e invierno, por lo que puede manejarse en rotación."
        elif viable_invierno and verano.ultima_superficie_ha:
            cycle = "Tiene registro en verano y puede funcionar en invierno, especialmente como forraje."
        elif invierno.ultima_superficie_ha:
            cycle = "Tiene registro de superficie en invierno."
        else:
            cycle = "Tiene registro principalmente en verano."
        return CampanaCultivoResponse(
            id=data["id"],
            departamento=_load_ine_data()["departamento"],
            fuente=_load_ine_data()["fuente"],
            cultivo=name,
            categoria=data["categoria"],
            hectareas_evaluadas=hectareas,
            viable_invierno=viable_invierno,
            nivel_adopcion_local=adoption,
            verano=verano,
            invierno=invierno,
            lectura_agronomica=(
                f"En La Paz se registran {surface_total:g} hectáreas de {name}. "
                f"{rendimiento_text} {cosecha_text} {cycle}"
            ),
        )
