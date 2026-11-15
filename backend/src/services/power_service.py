import asyncio
from statistics import fmean
from typing import Any

from src.core.config import Settings
from src.core.exceptions import PowerAPIError
from src.core.geo import sample_points
from src.core.presets import PARAMETER_PRESETS, resolve_parameters
from src.schemas.power import (
    DataQuery,
    PointRequest,
    PointResponse,
    PolygonRequest,
    PolygonResponse,
    Temporal,
)
from src.services.power_client import PowerClient


def _opts(q: DataQuery) -> dict[str, Any]:
    return {
        "community": q.community.value,
        "units": q.units.value,
        "time_standard": q.time_standard.value,
        "site_elevation": q.site_elevation,
        "wind_elevation": q.wind_elevation,
        "wind_surface": q.wind_surface,
    }


def _is_annual(key: str, temporal: Temporal) -> bool:
    """En monthly (YYYY13) y climatology (13) la clave 13 es el promedio anual."""
    return temporal in (Temporal.monthly, Temporal.climatology) and key.endswith("13")


class PowerService:
    def __init__(self, client: PowerClient, settings: Settings):
        self._client = client
        self._s = settings

    def presets(self) -> dict[str, list[str]]:
        return PARAMETER_PRESETS

    async def point(self, req: PointRequest) -> PointResponse:
        params = resolve_parameters(
            req.parameters, req.presets, req.temporal == Temporal.hourly
        )
        if not params:
            raise PowerAPIError(422, "Ningún parámetro disponible para este tipo temporal")
        data = await self._client.point(
            req.temporal, req.latitude, req.longitude, req.start, req.end, params, **_opts(req)
        )
        return PointResponse(**data)

    async def polygon(self, req: PolygonRequest) -> PolygonResponse:
        params = resolve_parameters(
            req.parameters, req.presets, req.temporal == Temporal.hourly
        )
        if not params:
            raise PowerAPIError(422, "Ningún parámetro disponible para este tipo temporal")

        coords = req.geometry.coordinates
        pts = sample_points(coords, req.grid_step, self._s.power_max_points)
        opts = _opts(req)

        results = await asyncio.gather(
            *(
                self._client.point(req.temporal, lat, lon, req.start, req.end, params, **opts)
                for lat, lon in pts
            ),
            return_exceptions=True,
        )

        ok: list[PointResponse] = []
        errors: list[dict[str, Any]] = []
        for (lat, lon), res in zip(pts, results):
            if isinstance(res, PowerAPIError):
                errors.append({"latitude": lat, "longitude": lon, "detail": res.detail})
            elif isinstance(res, Exception):
                raise res
            else:
                ok.append(PointResponse(**res))

        if not ok:
            first = errors[0]["detail"] if errors else "sin detalle"
            raise PowerAPIError(502, f"Ninguna consulta a NASA POWER tuvo éxito: {first}")

        aggregated = self._aggregate(ok)
        return PolygonResponse(
            query={
                "temporal": req.temporal.value,
                "start": req.start,
                "end": req.end,
                "community": req.community.value,
                "parameters": params,
                "grid_step": req.grid_step,
            },
            points_requested=len(pts),
            points_ok=len(ok),
            parameters=ok[0].parameters,
            aggregated=aggregated,
            summary=self._summary(aggregated, req.temporal),
            points=ok if req.include_points else None,
            errors=errors,
        )

    @staticmethod
    def _aggregate(points: list[PointResponse]) -> dict[str, dict[str, float | None]]:
        """Promedio por parámetro y fecha entre los puntos del polígono."""
        out: dict[str, dict[str, float | None]] = {}
        names = {n for p in points for n in p.data}
        for name in names:
            keys = dict.fromkeys(k for p in points for k in p.data.get(name, {}))
            series: dict[str, float | None] = {}
            for key in keys:
                vals = [
                    v
                    for p in points
                    if (v := p.data.get(name, {}).get(key)) is not None
                ]
                series[key] = round(fmean(vals), 4) if vals else None
            out[name] = series
        return out

    @staticmethod
    def _summary(
        aggregated: dict[str, dict[str, float | None]], temporal: Temporal
    ) -> dict[str, dict[str, float | int | None]]:
        out: dict[str, dict[str, float | int | None]] = {}
        for name, series in aggregated.items():
            vals = [
                v for k, v in series.items() if v is not None and not _is_annual(k, temporal)
            ]
            out[name] = (
                {"min": min(vals), "max": max(vals), "mean": round(fmean(vals), 4), "count": len(vals)}
                if vals
                else {"min": None, "max": None, "mean": None, "count": 0}
            )
        return out
