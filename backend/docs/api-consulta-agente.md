# Documentación: recomendación agrícola para un polígono

## Estudio de suelo

### Endpoint

```http
POST /api/soil/polygon
Content-Type: application/json
```

Este endpoint consulta variables físicas del suelo usando NASA POWER Agroclimatology y Open-Meteo. No requiere token ni API key. Las consultas repetidas se reutilizan desde la caché local SQLite.

### Campos de la solicitud

| Campo | Obligatorio | Tipo / valores | Descripción |
|---|---:|---|---|
| `geometry` | Sí | GeoJSON `Polygon` | Polígono que se analizará. |
| `geometry.coordinates` | Sí | Lista de posiciones | Coordenadas siempre en orden `[longitud, latitud]`. |
| `temporal` | No | `"daily"` o `"monthly"` | Resolución temporal. Predeterminado: `"daily"`. |
| `start` | Sí | `YYYY-MM-DD` | Fecha inicial del período. |
| `end` | Sí | `YYYY-MM-DD` | Fecha final; debe ser igual o posterior a `start`. |
| `parameters` | Sí* | Lista de métricas | `sm_surface`, `sm_rootzone`, `soil_temp`, `sm_profile`. |
| `presets` | Sí* | `soil`, `moisture`, `temperature` | Grupos de métricas predefinidos. |
| `grid_step` | No | Número entre `0.05` y `5.0` | Separación de los puntos muestreados. Predeterminado: `0.1`. |
| `include_points` | No | `true` o `false` | Incluye el detalle de cada punto. Predeterminado: `false`. |

\* Debe enviarse al menos un elemento en `parameters` o `presets`.

Métricas disponibles:

- `sm_surface`: humedad superficial del suelo.
- `sm_rootzone`: humedad de la zona radicular.
- `soil_temp`: temperatura del suelo.
- `sm_profile`: saturación del perfil del suelo.

### Ejemplo de solicitud

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [-68.15, -16.52],
        [-68.10, -16.52],
        [-68.10, -16.48],
        [-68.15, -16.48],
        [-68.15, -16.52]
      ]
    ]
  },
  "temporal": "daily",
  "start": "2024-01-01",
  "end": "2024-01-05",
  "parameters": [],
  "presets": ["soil"],
  "grid_step": 0.1,
  "include_points": true
}
```

La respuesta contiene `query`, `points_requested`, `points_ok`, `parameters`, `aggregated`, `summary`, `points` y `errors`. `aggregated` devuelve el promedio espacial por fecha y `summary` incluye `min`, `max`, `mean` y `count`.

## Endpoint

```http
POST /api/power/polygon/recommendation
Content-Type: application/json
```

El endpoint consulta primero NASA POWER para el polígono enviado, usando la misma operación que `POST /api/power/polygon`. Después envía a Gemini un JSON con la solicitud, los datos obtenidos, los cultivos a evaluar y las prioridades indicadas.

Gemini usa como instrucción el archivo [`prompt.md`](./prompt.md). La recomendación es una respuesta puntual: este endpoint no crea ni devuelve un `session_id` y no mantiene historial de conversación.

## Campos de la solicitud

La solicitud combina todos los campos de `PolygonRequest` con campos agrícolas y municipales.

### Polígono, fechas y consulta NASA POWER

| Campo | Obligatorio | Tipo / valores | Significado y comportamiento |
|---|---:|---|---|
| `geometry` | Sí | GeoJSON `Polygon` | Área que se analizará. Las posiciones deben estar en orden `[longitud, latitud]`, por ejemplo `[-68.2, -16.5]`. Cada anillo debe tener al menos 4 posiciones. Si no repite al final la primera coordenada, el backend la agrega para cerrarlo. |
| `temporal` | Sí* | `"daily"` o `"hourly"` | Resolución de los datos. Si se omite, el modelo usa `"daily"`. Este endpoint rechaza `"monthly"` y `"climatology"`, aunque el endpoint general de polígonos los admita. |
| `start` | Sí | Fecha `YYYY-MM-DD` | Inicio del período solicitado. Es obligatorio para las resoluciones admitidas. Para datos diarios, la fecha no puede ser anterior a `1981-01-01`. |
| `end` | Sí | Fecha `YYYY-MM-DD` | Fin del período solicitado; debe ser igual o posterior a `start`. Para datos horarios, el intervalo entre fechas no puede superar 366 días. |
| `parameters` | Sí si no se envía `presets` | Lista de códigos NASA POWER | Parámetros concretos que se solicitarán, como `T2M` o `PRECTOTCORR`. Los códigos se convierten a mayúsculas. Se pueden combinar con `presets`; los códigos repetidos se eliminan. |
| `presets` | Sí si no se envía `parameters` | Lista de nombres de preset | Agrega grupos de parámetros predefinidos (ver la sección [Presets](#presets-disponibles)). Se puede combinar con `parameters`. |
| `community` | No | `ag`, `re`, `sb`, `hy` | Comunidad de datos de NASA POWER. Predeterminado: `ag` (agroclimatología). |
| `units` | No | `"metric"` o `"imperial"` | Sistema de unidades devuelto por NASA POWER. Predeterminado: `"metric"`. |
| `time_standard` | No | `"lst"` o `"utc"` | Estándar horario para los datos. `lst` es hora solar local y `utc` es UTC. Predeterminado: `lst`. |
| `grid_step` | No | Número entre `0.1` y `5` | Separación, en grados, de los puntos muestreados dentro del polígono. Un paso menor puede generar más puntos y tardar más. Predeterminado: `0.5`. |
| `include_points` | No | `true` o `false` | Si es `true`, incluye en la respuesta la serie individual de cada punto consultado. Si es `false`, `polygon.points` será `null`; los agregados se devuelven en ambos casos. Predeterminado: `false`. |
| `site_elevation` | No | Número o `null` | Elevación del sitio, en metros, reenviada a NASA POWER cuando se especifica. También se comparte con Gemini como altitud disponible de la ubicación. |
| `wind_elevation` | No | Número o `null` | Elevación de referencia del viento reenviada a NASA POWER cuando se especifica. |
| `wind_surface` | No | Texto o `null` | Tipo de superficie para la consulta de viento, reenviado a NASA POWER cuando se especifica. |

\* `temporal` puede omitirse porque tiene valor predeterminado, pero `start` y `end` siguen siendo obligatorios.

Debe enviarse al menos una lista no vacía entre `parameters` y `presets`. Si se envían ambas, NASA POWER recibe la combinación de sus parámetros. Los códigos de `parameters` se pasan al servicio NASA POWER; un código mal escrito o no disponible puede hacer fallar la consulta. Para consultas horarias, elija parámetros disponibles en esa resolución. Los presets horarios omiten automáticamente los parámetros que NASA POWER no ofrece por hora.

### Presets disponibles

| Preset | Parámetros incluidos |
|---|---|
| `temperature` | `T2M`, `T2M_MAX`, `T2M_MIN`, `T2M_RANGE`, `TS`, `T2MDEW` |
| `precipitation` | `PRECTOTCORR` |
| `humidity` | `RH2M`, `QV2M` |
| `wind` | `WS2M`, `WS10M`, `WD2M` |
| `solar` | `ALLSKY_SFC_SW_DWN`, `CLRSKY_SFC_SW_DWN`, `ALLSKY_SFC_PAR_TOT`, `ALLSKY_SFC_LW_DWN` |
| `soil_moisture` | `GWETTOP`, `GWETROOT`, `GWETPROF` |
| `evapotranspiration` | `EVPTRNS`, `EVLAND` |
| `pressure` | `PS` |
| `agro_all` | Todos los parámetros anteriores |

En resolución horaria no se solicitan por preset `T2M_MAX`, `T2M_MIN`, `T2M_RANGE`, `GWETTOP`, `GWETROOT`, `GWETPROF`, `EVPTRNS` ni `EVLAND`.

### Datos para Gemini

| Campo | Obligatorio | Tipo / ejemplo | Significado y comportamiento |
|---|---:|---|---|
| `plants` | Sí | Lista de textos, por ejemplo `["papa", "haba"]` | Cultivos que Gemini debe evaluar. Debe contener al menos un nombre no vacío. |
| `municipality_id` | No | Entero, por ejemplo `2` | Identificador del municipio de La Paz. Si se envía, el backend busca sus datos municipales. Un ID inexistente produce `404`. Se pueden consultar IDs con `GET /api/v1/ine/la-paz/municipios`. |
| `municipality_name` | No | Texto, por ejemplo `"Palca"` | Nombre que se comparte con Gemini. Si se reconoce, también se adjunta la ficha municipal; si no se reconoce, se conserva el nombre recibido y la consulta continúa. |
| `priorities` | No | Texto libre | Preferencias del agricultor, por ejemplo `"priorizar ahorro de agua y reducir costos"`. Se envía a Gemini sin convertirla en un valor numérico ni alterar los datos de NASA POWER. |
| `crop_requirements` | No | Objeto JSON | Requerimientos agronómicos conocidos de los cultivos. Es útil incluir fuente, variedad y etapa; el backend no valida una estructura interna fija. |
| `current_crop` | No | Texto | Cultivo actual o anterior. Si se incluye, Gemini puede considerar rotación; si se omite, el prompt indica no asumir un cultivo anterior. |

`municipality_id` y `municipality_name` son independientes. Se puede enviar uno, ambos o ninguno. Si se envían ambos, el ID se usa para la búsqueda municipal y el nombre escrito se conserva en el contexto de Gemini.

La ubicación enviada al modelo contiene la geometría, los datos municipales reconocidos (si los hay) y `site_elevation` cuando se proporcione. No se calculan coordenadas ni altitud de parcela a partir de datos que no estén en la solicitud.

## Respuesta

La respuesta tiene dos propiedades principales:

| Campo | Contenido |
|---|---|
| `polygon` | Respuesta de NASA POWER producida por la consulta de polígono. Incluye la consulta ejecutada, cantidad de puntos, parámetros, series agregadas, resumen estadístico, puntos individuales opcionales y errores parciales. |
| `recommendation` | Texto detallado de Gemini en Markdown, con la comparación de todas las plantas solicitadas, porcentajes justificables, motivos, acciones y alternativas disponibles. Está pensado para renderizarse en el frontend. |
| `audio_summary` | Resumen independiente en español sencillo, de 3 a 6 frases, sin tablas ni formato Markdown. Está pensado para enviarse a texto-a-voz; no agrega datos distintos de la evaluación detallada. |

Estructura resumida de `polygon`:

- `query`: resolución, período, comunidad, parámetros y paso de muestreo utilizados.
- `points_requested` / `points_ok`: puntos consultados y puntos con respuesta exitosa.
- `parameters`: metadatos de los parámetros, incluidas sus unidades cuando NASA POWER las proporciona.
- `aggregated`: serie promedio por parámetro entre los puntos exitosos del polígono. Cada clave temporal apunta a un número o `null`.
- `summary`: mínimo, máximo, media y cantidad de valores disponibles por parámetro.
- `points`: series individuales solo si `include_points` fue `true`; en caso contrario es `null`.
- `errors`: fallos de puntos individuales que no impidieron completar la agregación.

Ejemplo de forma de respuesta (valores ilustrativos, no son datos reales):

```json
{
  "polygon": {
    "query": {
      "temporal": "daily",
      "start": "2024-01-01",
      "end": "2024-01-02",
      "community": "ag",
      "parameters": ["T2M"],
      "grid_step": 0.5
    },
    "points_requested": 4,
    "points_ok": 4,
    "parameters": {},
    "aggregated": {
      "T2M": {
        "20240101": 12.5,
        "20240102": 13.1
      }
    },
    "summary": {
      "T2M": {
        "min": 12.5,
        "max": 13.1,
        "mean": 12.8,
        "count": 2
      }
    },
    "points": null,
    "errors": []
  },
  "recommendation": "## A. Condiciones ambientales\\n\\n[Indicadores y datos disponibles]\\n\\n## B. Comparación\\n\\n[Tabla con una fila por planta y porcentajes justificables]\\n\\n## C. Evaluación por planta\\n\\n[Motivos, limitaciones y cuidados]\\n\\n## D. Alternativas\\n\\n[Opciones justificadas, si los datos lo permiten]\\n\\n## E. Conclusión\\n\\n[Decisión y próximos pasos]",
  "audio_summary": "[Resumen oral breve: qué opciones convienen, por qué y qué cuidados tomar.]"
}
```

El ejemplo muestra únicamente la estructura. Los porcentajes y recomendaciones reales dependen de la consulta. Si la información no permite calcular un porcentaje confiable, Gemini debe explicarlo en vez de inventar uno.

Gemini debe devolver `recommendation` y `audio_summary` como propiedades de un único objeto JSON. Si el proveedor devuelve una respuesta vacía o con formato inválido, la API responde con un error `502` en vez de presentar una respuesta incompleta como exitosa. `audio_summary` es texto preparado para que el frontend lo entregue a su sistema de texto a voz; este endpoint no genera un archivo de audio.

## Ejemplos de solicitudes

Reemplace `http://localhost:8000` por la dirección donde se ejecuta el backend. Puede enviar cualquiera de los JSON con:

```bash
curl -X POST "http://localhost:8000/api/power/polygon/recommendation" \
  -H "Content-Type: application/json" \
  -d @request.json
```

### Caso 1: datos diarios, presets y prioridad

Se evalúan dos cultivos con parámetros agroclimáticos diarios. No se envía municipio; por eso el modelo recibe la geometría como ubicación, sin ficha municipal.

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [-68.2, -16.5],
        [-68.1, -16.5],
        [-68.1, -16.4],
        [-68.2, -16.5]
      ]
    ]
  },
  "temporal": "daily",
  "start": "2024-01-01",
  "end": "2024-01-07",
  "presets": ["temperature", "precipitation", "humidity"],
  "plants": ["papa", "haba"],
  "priorities": "priorizar ahorro de agua",
  "grid_step": 0.5,
  "include_points": false
}
```

### Caso 2: datos horarios, parámetros explícitos y municipio

El ID `2` corresponde a Palca en el catálogo local de municipios. Para usar otro lugar, obtenga un ID válido con `GET /api/v1/ine/la-paz/municipios`. El rango horario de este ejemplo es de un día.

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [-67.95, -16.55],
        [-67.85, -16.55],
        [-67.85, -16.48],
        [-67.95, -16.48],
        [-67.95, -16.55]
      ]
    ]
  },
  "temporal": "hourly",
  "start": "2024-02-01",
  "end": "2024-02-02",
  "parameters": ["T2M", "RH2M", "WS2M"],
  "plants": ["quinua"],
  "municipality_id": 2,
  "municipality_name": "Palca",
  "site_elevation": 3500,
  "time_standard": "lst",
  "units": "metric",
  "grid_step": 0.5,
  "include_points": true
}
```

### Caso 3: usar `parameters` y `presets` juntos

Los parámetros explícitos se combinan con los del preset. Este ejemplo solicita `T2M` y también el grupo de precipitación. En Swagger, usa `POST /api/power/polygon/recommendation` (no `POST /api/v1/chat/message`, que requiere `field_id` y `message`):

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [-68.2, -16.5],
        [-68.1, -16.5],
        [-68.1, -16.4],
        [-68.2, -16.5]
      ]
    ]
  },
  "temporal": "daily",
  "start": "2024-03-01",
  "end": "2024-03-03",
  "parameters": ["T2M"],
  "presets": ["precipitation"],
  "plants": ["cebada"],
  "current_crop": "papa",
  "crop_requirements": {
    "cebada": {
      "source": "Indicar fuente consultada",
      "variety": "Variedad conocida",
      "stage": "crecimiento"
    }
  },
  "priorities": "reducir riesgos y costos"
}
```

## Casos de prueba de validación

Los siguientes casos deben responder con `422 Unprocessable Entity`, antes de consultar NASA POWER:

### Resolución no permitida

`monthly` y `climatology` son válidos en otros usos de `PolygonRequest`, pero no en este endpoint:

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[-68.2, -16.5], [-68.1, -16.5], [-68.1, -16.4], [-68.2, -16.5]]]
  },
  "temporal": "monthly",
  "start": "2024-01-01",
  "end": "2024-01-31",
  "parameters": ["T2M"],
  "plants": ["papa"]
}
```

### Falta el rango de fechas

`start` y `end` son obligatorios para `daily` y `hourly`:

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[-68.2, -16.5], [-68.1, -16.5], [-68.1, -16.4], [-68.2, -16.5]]]
  },
  "temporal": "daily",
  "parameters": ["T2M"],
  "plants": ["papa"]
}
```

### Faltan parámetros NASA POWER

Debe enviarse `parameters`, `presets` o ambos:

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[-68.2, -16.5], [-68.1, -16.5], [-68.1, -16.4], [-68.2, -16.5]]]
  },
  "start": "2024-01-01",
  "end": "2024-01-02",
  "plants": ["papa"]
}
```

### ID municipal inexistente

El cuerpo es válido en estructura, pero si `municipality_id` no existe en el catálogo de La Paz, la respuesta es `404 Not Found` y Gemini no recibe la solicitud:

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[-68.2, -16.5], [-68.1, -16.5], [-68.1, -16.4], [-68.2, -16.5]]]
  },
  "start": "2024-01-01",
  "end": "2024-01-02",
  "parameters": ["T2M"],
  "plants": ["papa"],
  "municipality_id": 999999
}
```
