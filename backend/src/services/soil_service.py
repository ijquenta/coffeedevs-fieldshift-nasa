import asyncio
from statistics import fmean

from src.core.exceptions import PowerAPIError
from src.core.geo import bbox, centroid, point_in_polygon
from src.schemas.soil import (
    ParameterSummary,
    PointErrorItem,
    PointResultItem,
    SoilPolygonRequest,
    SoilPolygonResponse,
)
from src.services.soil_client import SOIL_VARIABLES, SoilClient, resolve_parameters


class SoilService:
    def __init__(self, client: SoilClient):
        self._client = client

    async def polygon(self, req: SoilPolygonRequest) -> SoilPolygonResponse:
        parameters = resolve_parameters(req.parameters, req.presets)
        unknown = [name for name in parameters if name not in SOIL_VARIABLES]
        if unknown:
            raise PowerAPIError(422, f"Variables de suelo desconocidas: {unknown}")
        points = self._sample_points(req)
        results = await asyncio.gather(
            *(self._client.point(lat, lon, req.start, req.end, req.temporal) for lat, lon in points),
            return_exceptions=True,
        )
        ok, errors = [], []
        for (lat, lon), result in zip(points, results):
            if isinstance(result, PowerAPIError):
                errors.append(PointErrorItem(latitude=lat, longitude=lon, detail=result.detail))
            elif isinstance(result, Exception):
                errors.append(PointErrorItem(latitude=lat, longitude=lon, detail=str(result)))
            else:
                result["parameters"] = {name: result["parameters"][name] for name in parameters}
                result["data"] = {name: result["data"].get(name, {}) for name in parameters}
                ok.append(PointResultItem(**result))
        if not ok:
            raise PowerAPIError(502, errors[0].detail if errors else "sin detalle")
        aggregated = self._aggregate(ok)
        return SoilPolygonResponse(
            query={"temporal": req.temporal, "start": req.start, "end": req.end,
                   "community": "ag+open-meteo", "parameters": parameters, "grid_step": req.grid_step},
            points_requested=len(points), points_ok=len(ok), parameters=ok[0].parameters,
            aggregated=aggregated, summary=self._summary(aggregated),
            points=ok if req.include_points else None, errors=errors,
        )

    @staticmethod
    def _sample_points(req: SoilPolygonRequest) -> list[tuple[float, float]]:
        polygon = req.geometry.coordinates
        ring = polygon[0]
        clon, clat = centroid(ring)
        points = {}
        if point_in_polygon(clon, clat, polygon):
            points[(round(clat / 0.09), round(clon / 0.09))] = (clat, clon)
        min_lon, min_lat, max_lon, max_lat = bbox(ring)
        n_lat = int((max_lat - min_lat) / req.grid_step) + 1
        n_lon = int((max_lon - min_lon) / req.grid_step) + 1
        for i in range(n_lat):
            lat = min_lat + req.grid_step * (i + 0.5)
            for j in range(n_lon):
                lon = min_lon + req.grid_step * (j + 0.5)
                if lon <= max_lon and lat <= max_lat and point_in_polygon(lon, lat, polygon):
                    points.setdefault((round(lat / 0.09), round(lon / 0.09)), (lat, lon))
        result = list(points.values())
        if len(result) > 25:
            stride = len(result) / 25
            result = [result[int(i * stride)] for i in range(25)]
        return result

    @staticmethod
    def _aggregate(points: list[PointResultItem]):
        result = {}
        for name in {name for point in points for name in point.data}:
            keys = dict.fromkeys(key for point in points for key in point.data.get(name, {}))
            result[name] = {key: round(fmean(values), 4) if (values := [point.data.get(name, {}).get(key) for point in points if point.data.get(name, {}).get(key) is not None]) else None for key in keys}
        return result

    @staticmethod
    def _summary(aggregated):
        result = {}
        for name, series in aggregated.items():
            values = [value for value in series.values() if value is not None]
            result[name] = ParameterSummary(min=min(values) if values else None, max=max(values) if values else None, mean=round(fmean(values), 4) if values else None, count=len(values))
        return result
