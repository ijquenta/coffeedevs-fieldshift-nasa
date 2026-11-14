import asyncio
import logging
from datetime import date
from typing import Any

import httpx

from src.core.cache import TTLCache
from src.core.config import Settings
from src.core.exceptions import PowerAPIError
from src.schemas.power import Temporal

logger = logging.getLogger(__name__)

FILL_VALUE = -999
RETRY_STATUS = {429, 500, 502, 503, 504}


def _clean(value: Any) -> Any:
    return None if value == FILL_VALUE else value


class PowerClient:
    """Cliente asíncrono de bajo nivel para la API NASA POWER (point)."""

    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self._s = settings
        self._http = httpx.AsyncClient(
            base_url=settings.power_base_url,
            timeout=settings.power_timeout_s,
            headers={"User-Agent": "fieldshift-backend/1.0"},
            transport=transport,
        )
        self._sem = asyncio.Semaphore(settings.power_max_concurrency)
        self._cache = TTLCache(settings.power_cache_ttl_s)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        key = (path, tuple(sorted(params.items())))
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        retries = self._s.power_max_retries
        for attempt in range(1, retries + 1):
            async with self._sem:
                try:
                    resp = await self._http.get(path, params=params)
                except (httpx.TimeoutException, httpx.TransportError) as exc:
                    if attempt == retries:
                        raise PowerAPIError(504, f"No se pudo contactar NASA POWER: {exc!r}")
                    resp = None

            if resp is not None:
                if resp.status_code == 200:
                    data = resp.json()
                    self._cache.set(key, data)
                    return data
                if resp.status_code not in RETRY_STATUS or attempt == retries:
                    raise PowerAPIError(resp.status_code, self._error_detail(resp))
            await asyncio.sleep(0.5 * 2**attempt)

        raise PowerAPIError(502, "Reintentos agotados")

    @staticmethod
    def _error_detail(resp: httpx.Response) -> Any:
        try:
            body = resp.json()
        except ValueError:
            return resp.text[:500]
        return body.get("messages") or body.get("message") or body

    @staticmethod
    def _time_params(temporal: Temporal, start: date | None, end: date | None) -> dict[str, int]:
        if temporal in (Temporal.hourly, Temporal.daily):
            fmt = lambda d: int(d.strftime("%Y%m%d"))  # noqa: E731
            return {"start": fmt(start), "end": fmt(end)}
        out: dict[str, int] = {}
        if start:
            out["start"] = start.year
        if end:
            out["end"] = end.year
        return out

    async def _point_chunk(
        self,
        temporal: Temporal,
        lat: float,
        lon: float,
        start: date | None,
        end: date | None,
        parameters: list[str],
        opts: dict[str, Any],
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "latitude": lat,
            "longitude": lon,
            "community": opts["community"],
            "parameters": ",".join(parameters),
            "format": "json",
            "units": opts["units"],
            "time-standard": opts["time_standard"],
            **self._time_params(temporal, start, end),
        }
        if opts.get("site_elevation") is not None:
            params["site-elevation"] = opts["site_elevation"]
        if opts.get("wind_elevation") is not None:
            params["wind-elevation"] = opts["wind_elevation"]
        if opts.get("wind_surface"):
            params["wind-surface"] = opts["wind_surface"]
        if self._s.power_user:
            params["user"] = self._s.power_user
        return await self._get(f"/api/temporal/{temporal.value}/point", params)

    async def point(
        self,
        temporal: Temporal,
        lat: float,
        lon: float,
        start: date | None,
        end: date | None,
        parameters: list[str],
        **opts: Any,
    ) -> dict[str, Any]:
        """Consulta un punto, dividiendo los parámetros en lotes y normalizando la salida."""
        size = self._s.power_max_params_per_request
        chunks = [parameters[i : i + size] for i in range(0, len(parameters), size)]
        raws = await asyncio.gather(
            *(self._point_chunk(temporal, lat, lon, start, end, c, opts) for c in chunks)
        )

        merged: dict[str, Any] = {"parameters": {}, "data": {}}
        for raw in raws:
            coords = raw.get("geometry", {}).get("coordinates", [lon, lat, None])
            merged["longitude"], merged["latitude"] = coords[0], coords[1]
            merged["elevation"] = coords[2] if len(coords) > 2 else None
            merged["parameters"].update(raw.get("parameters", {}))
            for name, series in raw.get("properties", {}).get("parameter", {}).items():
                merged["data"][name] = {k: _clean(v) for k, v in series.items()}
        return merged
