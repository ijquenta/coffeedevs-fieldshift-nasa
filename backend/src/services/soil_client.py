import asyncio
import json
import sqlite3
from datetime import date, datetime
from pathlib import Path
from typing import Any

import httpx

from src.core.exceptions import PowerAPIError
from src.schemas.soil import ParameterMeta


SOIL_VARIABLES = {
    "sm_surface": ParameterMeta(units="m3/m3", longname="Surface Soil Moisture (0-5 cm)"),
    "sm_rootzone": ParameterMeta(units="m3/m3", longname="Root Zone Soil Moisture (0-100 cm)"),
    "soil_temp": ParameterMeta(units="C", longname="Soil Temperature (0-7 cm)"),
    "sm_profile": ParameterMeta(units="%", longname="Profile Soil Moisture Wetness"),
}

SOIL_PRESETS = {
    "soil": list(SOIL_VARIABLES),
    "moisture": ["sm_surface", "sm_rootzone", "sm_profile"],
    "temperature": ["soil_temp"],
}

NASA_NAMES = {
    "sm_surface": "GWETTOP",
    "sm_rootzone": "GWETROOT",
    "soil_temp": "TSOIL1",
    "sm_profile": "GWETPROF",
}

OPEN_METEO_NAMES = {
    "sm_surface": "soil_moisture_0_to_7cm",
    "sm_rootzone": "soil_moisture_28_to_100cm",
    "soil_temp": "soil_temperature_0_to_7cm",
}


def resolve_parameters(parameters: list[str], presets: list[str]) -> list[str]:
    result = [item.strip().lower() for item in parameters if item.strip()]
    for preset in presets:
        result.extend(SOIL_PRESETS[preset])
    return list(dict.fromkeys(result))


class SoilClient:
    """Cliente JSON sin credenciales, con caché persistente SQLite."""

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None):
        data_dir = Path(__file__).resolve().parents[2] / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        self._db_path = data_dir / "fieldshift_cache.db"
        with sqlite3.connect(self._db_path) as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS soil_cache "
                "(cache_key TEXT PRIMARY KEY, payload_json TEXT, created_at TEXT)"
            )
        self._http = httpx.AsyncClient(timeout=30.0, transport=transport)
        self._sem = asyncio.Semaphore(4)

    async def aclose(self) -> None:
        await self._http.aclose()

    def _read_cache(self, key: str) -> dict[str, Any] | None:
        with sqlite3.connect(self._db_path) as db:
            row = db.execute(
                "SELECT payload_json FROM soil_cache WHERE cache_key = ?", (key,)
            ).fetchone()
        return json.loads(row[0]) if row else None

    def _write_cache(self, key: str, payload: dict[str, Any]) -> None:
        with sqlite3.connect(self._db_path) as db:
            db.execute(
                "INSERT OR REPLACE INTO soil_cache(cache_key, payload_json, created_at) "
                "VALUES (?, ?, ?)",
                (key, json.dumps(payload), datetime.utcnow().isoformat()),
            )

    async def point(
        self, lat: float, lon: float, start: str, end: str, temporal: str
    ) -> dict[str, Any]:
        key = json.dumps([lon, lat, start, end, temporal], separators=(",", ":"))
        cached = await asyncio.to_thread(self._read_cache, key)
        if cached is not None:
            return cached
        async with self._sem:
            payload = await self._fetch(lat, lon, start, end, temporal)
        await asyncio.to_thread(self._write_cache, key, payload)
        return payload

    async def _fetch(
        self, lat: float, lon: float, start: str, end: str, temporal: str
    ) -> dict[str, Any]:
        nasa_task = self._nasa(lat, lon, start, end, temporal)
        meteo_task = self._open_meteo(lat, lon, start, end, temporal)
        nasa, meteo = await asyncio.gather(nasa_task, meteo_task, return_exceptions=True)
        nasa_data = {} if isinstance(nasa, Exception) else nasa
        meteo_data = {} if isinstance(meteo, Exception) else meteo
        data = {name: nasa_data.get(name, {}) for name in SOIL_VARIABLES}
        for name, series in meteo_data.items():
            if not data[name]:
                data[name] = series
        if not any(data.values()):
            details = [str(error) for error in (nasa, meteo) if isinstance(error, Exception)]
            raise PowerAPIError(502, "No se obtuvieron datos de suelo: " + "; ".join(details))
        return {
            "latitude": lat,
            "longitude": lon,
            "parameters": {name: SOIL_VARIABLES[name].model_dump() for name in SOIL_VARIABLES},
            "data": data,
        }

    async def _nasa(self, lat: float, lon: float, start: str, end: str, temporal: str):
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
        params = {
            "latitude": lat,
            "longitude": lon,
            "community": "ag",
            "parameters": ",".join(NASA_NAMES.values()),
            "format": "json",
            "start": int(start_date.strftime("%Y" if temporal == "monthly" else "%Y%m%d")),
            "end": int(end_date.strftime("%Y" if temporal == "monthly" else "%Y%m%d")),
        }
        response = await self._http.get(
            f"https://power.larc.nasa.gov/api/temporal/{temporal}/point", params=params
        )
        response.raise_for_status()
        raw = response.json()
        source = raw.get("properties", {}).get("parameter", {})
        out = {}
        for name, nasa_name in NASA_NAMES.items():
            series = source.get(nasa_name, {})
            out[name] = self._monthly(series) if temporal == "monthly" else self._clean(series)
        return out

    async def _open_meteo(self, lat: float, lon: float, start: str, end: str, temporal: str):
        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start,
            "end_date": end,
            "hourly": ",".join(OPEN_METEO_NAMES.values()),
            "timezone": "UTC",
        }
        response = await self._http.get("https://api.open-meteo.com/v1/forecast", params=params)
        response.raise_for_status()
        raw = response.json()
        hourly = raw.get("hourly", {})
        dates = hourly.get("time", [])
        out = {}
        for name, meteo_name in OPEN_METEO_NAMES.items():
            values = dict(zip(dates, hourly.get(meteo_name, [])))
            daily = self._daily(values)
            out[name] = self._monthly(daily) if temporal == "monthly" else daily
        return out

    @staticmethod
    def _clean(series: dict[str, Any]) -> dict[str, float | None]:
        return {key: (None if value in (-999, -999.0) else value) for key, value in series.items()}

    @staticmethod
    def _daily(series: dict[str, Any]) -> dict[str, float | None]:
        grouped: dict[str, list[float]] = {}
        for key, value in series.items():
            if value is not None:
                grouped.setdefault(key[:10].replace("-", ""), []).append(float(value))
        return {key: round(sum(values) / len(values), 4) for key, values in grouped.items()}

    @staticmethod
    def _monthly(series: dict[str, Any]) -> dict[str, float | None]:
        grouped: dict[str, list[float]] = {}
        for key, value in series.items():
            if value is not None:
                grouped.setdefault(key[:6], []).append(float(value))
        return {key: round(sum(values) / len(values), 4) for key, values in grouped.items()}
