"""Utilidades geométricas sin dependencias externas. Coordenadas GeoJSON: [lon, lat]."""

CELL_LAT = 0.5
CELL_LON = 0.625  # resolución nativa MERRA-2


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def point_in_polygon(lon: float, lat: float, polygon: list[list[list[float]]]) -> bool:
    if not point_in_ring(lon, lat, polygon[0]):
        return False
    return not any(point_in_ring(lon, lat, hole) for hole in polygon[1:])


def centroid(ring: list[list[float]]) -> tuple[float, float]:
    """Centroide ponderado por área. Devuelve (lon, lat)."""
    area = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(area) < 1e-12:
        n = len(ring)
        return sum(p[0] for p in ring) / n, sum(p[1] for p in ring) / n
    area *= 0.5
    return cx / (6 * area), cy / (6 * area)


def bbox(ring: list[list[float]]) -> tuple[float, float, float, float]:
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return min(lons), min(lats), max(lons), max(lats)


def _cell(lat: float, lon: float) -> tuple[int, int]:
    return round(lat / CELL_LAT), round(lon / CELL_LON)


def sample_points(
    polygon: list[list[list[float]]], step: float, max_points: int
) -> list[tuple[float, float]]:
    """Puntos (lat, lon) dentro del polígono, uno por celda nativa de POWER.

    Siempre incluye el centroide, de modo que un lote pequeño genera una sola consulta.
    """
    ring = polygon[0]
    clon, clat = centroid(ring)
    points: dict[tuple[int, int], tuple[float, float]] = {_cell(clat, clon): (clat, clon)}

    min_lon, min_lat, max_lon, max_lat = bbox(ring)
    n_lat = int((max_lat - min_lat) / step) + 1
    n_lon = int((max_lon - min_lon) / step) + 1
    for i in range(n_lat):
        lat = min_lat + step * (i + 0.5)
        if lat > max_lat:
            continue
        for k in range(n_lon):
            lon = min_lon + step * (k + 0.5)
            if lon > max_lon:
                continue
            if point_in_polygon(lon, lat, polygon):
                points.setdefault(_cell(lat, lon), (lat, lon))

    result = list(points.values())
    if len(result) > max_points:
        stride = len(result) / max_points
        result = [result[int(i * stride)] for i in range(max_points)]
    return result
