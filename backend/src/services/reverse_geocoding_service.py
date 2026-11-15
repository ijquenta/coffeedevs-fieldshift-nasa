from dataclasses import dataclass
from typing import Any

import httpx


NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"


@dataclass(frozen=True)
class ReverseGeocodedLocation:
    municipality_name: str | None
    department_name: str | None
    country_code: str | None


class ReverseGeocodingError(Exception):
    pass


class ReverseGeocodingService:
    async def reverse(self, latitude: float, longitude: float) -> ReverseGeocodedLocation:
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 10,
            "countrycodes": "bo",
        }
        try:
            async with httpx.AsyncClient(
                timeout=8.0,
                headers={"User-Agent": "FieldShift/1.0 (polygon agricultural recommendations)"},
            ) as client:
                response = await client.get(NOMINATIM_REVERSE_URL, params=params)
                response.raise_for_status()
                payload: dict[str, Any] = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ReverseGeocodingError("No se pudo resolver la ubicación por coordenadas") from exc

        address = payload.get("address") or {}
        municipality = next(
            (
                address[key]
                for key in ("municipality", "city", "town", "village", "county", "district")
                if address.get(key)
            ),
            None,
        )
        department = address.get("state") or address.get("region") or address.get("state_district")
        return ReverseGeocodedLocation(
            municipality_name=municipality,
            department_name=department,
            country_code=address.get("country_code"),
        )
