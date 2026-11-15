# Documentación del backend Field Shift

El backend recibe coordenadas o polígonos desde el frontend, consulta NASA POWER y devuelve los datos normalizados. Los nombres de campos se mantienen tal como los expone la API; las descripciones están en español.

Los valores numéricos de los ejemplos son ilustrativos.

### 3.1 Campos comunes del request

| Campo | Tipo | Requerido | Valor por defecto | Descripción |
|---|---|---|---|---|
| `temporal` | string (enum) | No | `daily` | Resolución temporal de los datos: `hourly`, `daily`, `monthly` o `climatology`. |
| `start` | string (fecha `YYYY-MM-DD`) | Sí, salvo en `climatology` | `null` | Fecha inicial del rango histórico. |
| `end` | string (fecha `YYYY-MM-DD`) | Sí, salvo en `climatology` | `null` | Fecha final del rango histórico. |
| `community` | string (enum) | No | `ag` | Comunidad de usuario de NASA POWER: `ag`, `re` o `sb`. Define las unidades y la convención de nombres con que se entregan las variables (ver sección 3.1.1). El esquema de NASA también acepta `hy`, pero no está documentado y no se recomienda. |
| `parameters` | array de string | Condicional | `[]` | Abreviaturas de variables POWER, por ejemplo `["T2M", "PRECTOTCORR"]`. |
| `presets` | array de string | Condicional | `[]` | Nombres de grupos predefinidos (ver sección 4). |
| `units` | string (enum) | No | `metric` | `metric` o `imperial`. |
| `time_standard` | string (enum) | No | `lst` | `lst` (hora solar local) o `utc`. |
| `site_elevation` | number | No | `null` | Elevación del sitio en metros, para corregir la presión atmosférica. |
| `wind_elevation` | number | No | `null` | Altura en metros para ajustar la velocidad del viento. |
| `wind_surface` | string | No | `null` | Tipo de superficie para el ajuste del viento (por ejemplo `grass`). |

Reglas de validación:

- Debe indicarse al menos uno entre `parameters` y `presets`. Ambos pueden combinarse; el resultado se une sin duplicados.
- Los valores de `presets` deben existir en la sección 4.
- `start` debe ser menor o igual que `end`.
- Con `temporal = daily`, `start` no puede ser anterior a `1981-01-01`.
- Con `temporal = hourly`, el rango no puede superar 366 días.
- Con `monthly` y `climatology` solo se utiliza el año de `start` y `end`.

#### 3.1.1 Comunidades (`community`)

Una comunidad es el perfil de usuario para el que NASA POWER presenta los datos. El campo `community` no cambia la ubicación ni las fechas consultadas; cambia cómo se entregan las variables: las unidades, la convención de nombres propia de cada sector y la lista de variables disponibles.

| Valor | Comunidad | Orientada a | Uso en este proyecto |
|---|---|---|---|
| `ag` | Agroclimatología | Modelos de cultivo, riego y clima agrícola. | Recomendada. Todos los presets del backend están pensados para esta comunidad. |
| `re` | Energía renovable (Renewable Energy) | Diseño y evaluación de sistemas solares y eólicos. | Útil solo si se analiza potencial de energía solar; usa unidades de energía. |
| `sb` | Infraestructura sostenible (antes Edificios Sostenibles) | Consumo energético y climatización de edificaciones. | No aplica a análisis agrícola. |
| `hy` | No documentada | Aparece en el esquema OpenAPI de NASA, pero la documentación oficial solo describe `ag`, `re` y `sb`. | Evitar. |

Qué ocurre según lo que se envíe:

- **Se omite `community`:** el backend usa `ag`.
- **Se envía `ag`, `re` o `sb`:** la consulta devuelve las mismas fechas y la misma ubicación; cambian las unidades y los nombres de las variables. Una misma variable puede entregarse en unidades distintas según la comunidad. Por ejemplo, NASA documenta la irradiancia solar `ALLSKY_SFC_SW_DWN` en kW-hr/m^2/day para `re`, mientras que otras comunidades o versiones de la API la entregan en otras unidades. No se deben comparar valores de consultas con comunidades diferentes sin revisar `parameters.<NOMBRE>.units` en la respuesta, que es la fuente de verdad de las unidades.
- **Se pide una variable que no existe para la comunidad elegida:** NASA POWER indica en su catálogo en qué comunidades ofrece cada variable (por ejemplo `T2M` está disponible en `ag`, `re` y `sb`). Ante una variable no disponible lo esperable es un error `422` de NASA con el detalle, que el backend reenvía sin modificar.
- **Se envía un valor que no pertenece al enum** (por ejemplo `"agro"`): el backend responde `422` por validación, sin llamar a NASA.

Ejemplo comparativo. La siguiente consulta usa `ag`; al cambiar únicamente `"community"` por `"re"` se obtiene el mismo punto y las mismas fechas, y debe revisarse `parameters.ALLSKY_SFC_SW_DWN.units` para ver el cambio de unidades:

```json
{
  "latitude": -17.39,
  "longitude": -66.16,
  "temporal": "daily",
  "start": "2024-09-01",
  "end": "2024-09-03",
  "parameters": ["ALLSKY_SFC_SW_DWN"],
  "community": "ag"
}
```

El catálogo oficial de variables por comunidad y resolución temporal se puede consultar en el navegador, por ejemplo para agroclimatología diaria: `https://power.larc.nasa.gov/api/system/manager/parameters?temporal=daily&community=ag`.

### 3.2 Claves temporales de las series

Las series devueltas son objetos de la forma `{ clave: valor }`. La clave depende de `temporal`:

| `temporal` | Formato de la clave | Ejemplo | Observación |
|---|---|---|---|
| `hourly` | `YYYYMMDDHH` | `2024090103` | Una clave por hora. |
| `daily` | `YYYYMMDD` | `20240901` | Una clave por día. |
| `monthly` | `YYYYMM` | `202203` | La clave `YYYY13` (por ejemplo `202213`) es el promedio anual. |
| `climatology` | `1` a `13` | `7` | `1` a `12` son los meses y `13` el promedio anual. |

Los valores faltantes (`-999` en NASA POWER) se devuelven como `null`.

### 3.3 Objeto `PointResponse`

| Campo | Tipo | Descripción |
|---|---|---|
| `latitude` | number | Latitud del punto consultado. |
| `longitude` | number | Longitud del punto consultado. |
| `elevation` | number o `null` | Elevación del punto según NASA POWER (promedio de la celda MERRA-2). |
| `parameters` | object | Metadatos por parámetro: `{ NAME: { "units": string, "longname": string } }`. |
| `data` | object | Series por parámetro: `{ NAME: { clave_temporal: number o null } }`. |

## 4. GET `/api/power/presets`

### Antes: solicitud

No recibe parámetros ni cuerpo.

### Durante: procesamiento

Devuelve el diccionario interno de `core/presets.py`. El preset `agro_all` agrupa todos los demás. Cuando `temporal = hourly`, los parámetros que NASA POWER no ofrece a resolución horaria se excluyen automáticamente de los presets: `T2M_MAX`, `T2M_MIN`, `T2M_RANGE`, `GWETTOP`, `GWETROOT`, `GWETPROF`, `EVPTRNS` y `EVLAND`. Los parámetros indicados manualmente en `parameters` nunca se filtran.

### Después: respuesta

Código `200`. Objeto de tipo `{ nombre_preset: array de string }`.

| Preset | Parámetros | Qué representan |
|---|---|---|
| `temperature` | `T2M`, `T2M_MAX`, `T2M_MIN`, `T2M_RANGE`, `TS`, `T2MDEW` | Temperatura del aire a 2 m (media, máxima, mínima y rango), temperatura de la superficie terrestre y punto de rocío. |
| `precipitation` | `PRECTOTCORR` | Precipitación corregida. |
| `humidity` | `RH2M`, `QV2M` | Humedad relativa y humedad específica a 2 m. |
| `wind` | `WS2M`, `WS10M`, `WD2M` | Velocidad del viento a 2 m y 10 m, y dirección a 2 m. |
| `solar` | `ALLSKY_SFC_SW_DWN`, `CLRSKY_SFC_SW_DWN`, `ALLSKY_SFC_PAR_TOT`, `ALLSKY_SFC_LW_DWN` | Radiación solar de onda corta con cielo real y despejado, radiación fotosintéticamente activa y radiación de onda larga. |
| `soil_moisture` | `GWETTOP`, `GWETROOT`, `GWETPROF` | Humedad del suelo superficial, de la zona radicular y del perfil completo. |
| `evapotranspiration` | `EVPTRNS`, `EVLAND` | Evapotranspiración y evaporación sobre el terreno. |
| `pressure` | `PS` | Presión superficial. |
| `agro_all` | Unión de todos los anteriores | Conjunto completo de variables agrícolas. |

#### Variables de radiación del preset `solar`

Las cuatro variables describen la energía que llega al suelo en distintas condiciones. Lectura de los nombres: `ALLSKY` es cielo real (con nubes); `CLRSKY` es cielo despejado (calculado sin nubes); `SFC` es la superficie terrestre; `SW` es onda corta (la luz del sol); `LW` es onda larga (radiación infrarroja térmica); `DWN` es descendente, es decir, la que llega hacia el suelo; `PAR` es radiación fotosintéticamente activa.

| Parámetro | Nombre en NASA | Qué mide | Utilidad agrícola |
|---|---|---|---|
| `ALLSKY_SFC_SW_DWN` | All Sky Surface Shortwave Downward Irradiance | Radiación solar que llega a una superficie horizontal del suelo, considerando la nubosidad real de cada día. | Variable solar principal: energía disponible para la fotosíntesis y la evapotranspiración. |
| `CLRSKY_SFC_SW_DWN` | Clear Sky Surface Shortwave Downward Irradiance | La misma radiación, pero calculada como si no hubiera nubes: el máximo posible para ese lugar y fecha. | Referencia. Comparada con la anterior, indica cuánto reduce la nubosidad la radiación disponible. |
| `ALLSKY_SFC_PAR_TOT` | All Sky Surface Photosynthetically Active Radiation (PAR) Total | La parte del espectro solar que las plantas aprovechan para la fotosíntesis (aproximadamente entre 400 y 700 nm), con cielo real. | Modelos de crecimiento y rendimiento de cultivos. |
| `ALLSKY_SFC_LW_DWN` | All Sky Surface Longwave Downward Irradiance | Radiación infrarroja térmica que la atmósfera y las nubes emiten hacia el suelo. No es luz solar. | Balance de energía del suelo: las noches nubladas retienen más calor y las despejadas favorecen las heladas. |

Qué ocurre según lo que se envíe en `parameters`:

- **Solo `ALLSKY_SFC_SW_DWN`:** se obtiene la radiación real recibida. Es suficiente para la mayoría de los análisis.
- **`ALLSKY_SFC_SW_DWN` y `CLRSKY_SFC_SW_DWN`:** el backend devuelve ambas como series separadas en `data` y en `aggregated`. El cociente entre ellas (real sobre despejado) se calcula en el cliente y funciona como índice de nubosidad efectiva.
- **`ALLSKY_SFC_PAR_TOT`:** es una variable distinta, no un subconjunto ni un reemplazo de la radiación de onda corta. Tiene su propia unidad y no debe sumarse con las demás.
- **`ALLSKY_SFC_LW_DWN`:** representa energía térmica, no radiación solar. No debe mezclarse con las de onda corta en un mismo cálculo.
- **`"presets": ["solar"]`:** envía las cuatro variables en una sola consulta; cada una trae su unidad en `parameters.<NOMBRE>.units`.

Ejemplo de respuesta (recortada):

```json
{
  "temperature": ["T2M", "T2M_MAX", "T2M_MIN", "T2M_RANGE", "TS", "T2MDEW"],
  "precipitation": ["PRECTOTCORR"],
  "soil_moisture": ["GWETTOP", "GWETROOT", "GWETPROF"]
}
```

## 5. POST `/api/power/point`

Obtiene la serie temporal de una coordenada.

### Antes: solicitud

Cuerpo `PointRequest`: los campos de la sección 3.1 más los siguientes.

| Campo | Tipo | Requerido | Rango | Descripción |
|---|---|---|---|---|
| `latitude` | number | Sí | -90 a 90 | Latitud en grados decimales (Sur negativo). |
| `longitude` | number | Sí | -180 a 180 | Longitud en grados decimales (Oeste negativo). |

Ejemplo (valle de Cochabamba, diario):

```json
{
  "latitude": -17.39,
  "longitude": -66.16,
  "temporal": "daily",
  "start": "2024-09-01",
  "end": "2024-09-03",
  "parameters": ["T2M", "PRECTOTCORR", "RH2M"]
}
```

### Durante: procesamiento

1. Se resuelven `parameters` y `presets` en una lista única de variables.
2. Las variables se dividen en lotes de hasta 15 por petición a NASA POWER y los lotes se ejecutan en paralelo.
3. Las respuestas se combinan, se reemplaza `-999` por `null` y se normaliza la estructura.
4. Si la misma consulta se repite dentro de una hora, se responde desde la caché en memoria.

### Después: respuesta

Código `200`. Objeto `PointResponse` (sección 3.3).

```json
{
  "latitude": -17.39,
  "longitude": -66.16,
  "elevation": 2790.5,
  "parameters": {
    "T2M": { "units": "C", "longname": "Temperature at 2 Meters" },
    "PRECTOTCORR": { "units": "mm/day", "longname": "Precipitation Corrected" },
    "RH2M": { "units": "%", "longname": "Relative Humidity at 2 Meters" }
  },
  "data": {
    "T2M": { "20240901": 14.8, "20240902": 15.3, "20240903": 15.9 },
    "PRECTOTCORR": { "20240901": 0.0, "20240902": 0.12, "20240903": null },
    "RH2M": { "20240901": 38.2, "20240902": 41.5, "20240903": 44.0 }
  }
}
```

## 6. POST `/api/power/polygon`

Obtiene la serie agregada de un polígono. Como NASA POWER consulta por punto, el backend muestrea el polígono y promedia los resultados.

### Antes: solicitud

Cuerpo `PolygonRequest`: los campos de la sección 3.1 más los siguientes.

| Campo | Tipo | Requerido | Valor por defecto | Descripción |
|---|---|---|---|---|
| `geometry` | object (`GeoPolygon`) | Sí | | Polígono en formato GeoJSON. |
| `geometry.type` | string | No | `Polygon` | Solo se admite `Polygon`. |
| `geometry.coordinates` | array de anillos | Sí | | Lista de anillos; cada anillo es una lista de posiciones `[longitud, latitud]`. El primer anillo es el contorno exterior y los siguientes son huecos. |
| `grid_step` | number | No | `0.5` | Paso de muestreo en grados. Rango permitido: 0.1 a 5. |
| `include_points` | boolean | No | `false` | Si es `true`, incluye la serie de cada punto muestreado en `points`. |

Reglas de `geometry`:

- El orden de las coordenadas es `[longitud, latitud]`, como en GeoJSON.
- Cada anillo requiere al menos 4 posiciones. Si el anillo no está cerrado, el backend repite la primera posición al final.
- Longitud entre -180 y 180, latitud entre -90 y 90.

Ejemplo (lote en Montero, Santa Cruz):

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[-63.26, -17.34], [-63.25, -17.34], [-63.25, -17.33], [-63.26, -17.33], [-63.26, -17.34]]]
  },
  "temporal": "daily",
  "start": "2024-01-01",
  "end": "2024-01-02",
  "presets": ["temperature", "soil_moisture"]
}
```

### Durante: procesamiento

1. Se calcula el centroide del polígono, que siempre se incluye como punto de consulta.
2. Se genera una malla de puntos con separación `grid_step` y se conservan los que caen dentro del polígono, excluyendo los huecos.
3. Se descartan puntos repetidos de la misma celda nativa de NASA POWER (0.5 grados de latitud por 0.625 de longitud), de modo que cada celda se consulta una sola vez. Un lote menor a una celda genera una única consulta.
4. Si hay más de 25 puntos (`POWER_MAX_POINTS`), se submuestrean de forma uniforme.
5. Las consultas se ejecutan en paralelo con un máximo de 4 simultáneas (`POWER_MAX_CONCURRENCY`).
6. Por cada parámetro y clave temporal, `aggregated` contiene el promedio de los puntos con dato, redondeado a 4 decimales. Si ningún punto tiene dato, el valor es `null`.
7. `summary` calcula mínimo, máximo, media y cantidad sobre la serie agregada. En `monthly` y `climatology` se excluye el promedio anual (clave terminada en `13`).
8. Los puntos que fallan no interrumpen la respuesta: se registran en `errors`. Solo si fallan todos se devuelve el error `502`.

### Después: respuesta

Código `200`. Objeto `PolygonResponse`:

| Campo | Tipo | Descripción |
|---|---|---|
| `query` | object | Resumen de la consulta efectuada: `temporal`, `start`, `end`, `community`, `parameters` (lista resuelta) y `grid_step`. |
| `points_requested` | integer | Cantidad de puntos consultados. |
| `points_ok` | integer | Cantidad de puntos que respondieron correctamente. |
| `parameters` | object | Metadatos por parámetro, con `units` y `longname`. |
| `aggregated` | object | Serie promedio del polígono: `{ NAME: { clave_temporal: number o null } }`. |
| `summary` | object | Estadísticas por parámetro: `{ NAME: { "min": number, "max": number, "mean": number, "count": integer } }`. Los cuatro valores son `null` o `0` si no hay datos. |
| `points` | array de `PointResponse` o `null` | Serie de cada punto. Solo se llena si `include_points` es `true`. |
| `errors` | array de object | Puntos fallidos: `{ "latitude": number, "longitude": number, "detail": string o array }`. |

```json
{
  "query": {
    "temporal": "daily",
    "start": "2024-01-01",
    "end": "2024-01-02",
    "community": "ag",
    "parameters": ["T2M", "T2M_MAX", "T2M_MIN", "T2M_RANGE", "TS", "T2MDEW", "GWETTOP", "GWETROOT", "GWETPROF"],
    "grid_step": 0.5
  },
  "points_requested": 1,
  "points_ok": 1,
  "parameters": {
    "T2M": { "units": "C", "longname": "Temperature at 2 Meters" },
    "GWETROOT": { "units": "1", "longname": "Root Zone Soil Wetness" }
  },
  "aggregated": {
    "T2M": { "20240101": 26.4, "20240102": 25.9 },
    "GWETROOT": { "20240101": 0.71, "20240102": 0.73 }
  },
  "summary": {
    "T2M": { "min": 25.9, "max": 26.4, "mean": 26.15, "count": 2 },
    "GWETROOT": { "min": 0.71, "max": 0.73, "mean": 0.72, "count": 2 }
  },
  "points": null,
  "errors": []
}
```

Ejemplo de `errors` cuando un punto falla (respuesta aún `200`):

```json
{
  "points_requested": 7,
  "points_ok": 6,
  "errors": [
    { "latitude": -17.9, "longitude": -63.9, "detail": "The POWER Daily API is unreachable due too many requests are being submitted." }
  ]
}
```

## 7. GET `/health`

Sin parámetros. Código `200`:

```json
{ "status": "ok" }
```

## 8. Manejo de errores

| Código | Origen | Cuándo ocurre |
|---|---|---|
| 422 | Validación del backend | Request mal formado: falta `parameters` y `presets`, preset desconocido, fechas inválidas, polígono inválido o coordenadas fuera de rango. |
| 422 | NASA POWER | Parámetro no disponible para la resolución o comunidad solicitada. Se reenvía el mensaje de NASA. |
| 422 | Backend | Todos los presets elegidos quedan vacíos para `hourly`. |
| 429 | NASA POWER | Demasiadas solicitudes, una vez agotados los reintentos. |
| 503 | NASA POWER | Servicio de respaldo de NASA no disponible. |
| 504 | Red | Tiempo de espera agotado o fallo de conexión con NASA POWER. |
| 502 | Backend | Cualquier otro error de NASA POWER, o fallo de todos los puntos de un polígono. |

Errores originados en NASA POWER y en la capa de red (excepto la validación inicial) usan el formato:

```json
{ "detail": "Descripción del error o lista de mensajes" }
```

Los errores de validación del backend usan el formato estándar de FastAPI:

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body"],
      "msg": "Value error, Indique 'parameters' o 'presets'",
      "input": {}
    }
  ]
}
```

Reintentos: ante errores `429`, `500`, `502`, `503`, `504` o fallos de red, el cliente reintenta hasta `POWER_MAX_RETRIES` veces con espera creciente.

## 9. Configuración

Las variables se leen del entorno o de un archivo `.env` en `backend/src`.

| Variable | Tipo | Valor por defecto | Descripción |
|---|---|---|---|
| `POWER_BASE_URL` | string | `https://power.larc.nasa.gov` | URL base de NASA POWER. |
| `POWER_TIMEOUT_S` | number | `60` | Tiempo máximo de espera por petición, en segundos. |
| `POWER_MAX_RETRIES` | integer | `3` | Intentos máximos por petición. |
| `POWER_MAX_CONCURRENCY` | integer | `4` | Peticiones simultáneas hacia NASA POWER. |
| `POWER_MAX_PARAMS_PER_REQUEST` | integer | `15` | Parámetros por petición; si se supera, se dividen en lotes. |
| `POWER_MAX_POINTS` | integer | `25` | Máximo de puntos consultados por polígono. |
| `POWER_CACHE_TTL_S` | integer | `3600` | Duración de la caché en segundos. |
| `POWER_USER` | string | `null` | Identificador enviado a NASA POWER como parámetro `user`. |
| `CORS_ORIGINS` | lista JSON | `["*"]` | Orígenes permitidos, por ejemplo `["http://localhost:5173"]`. |




Ejemplos
Los valores numéricos de las respuestas son ilustrativos, porque no tengo salida a la API de NASA desde aquí. La estructura es exactamente la que devuelve el backend. Todos los ejemplos son `POST` a `http://localhost:8000`.

## 1. Punto diario: valle de Cochabamba

`POST /api/power/point`

```json
{
  "latitude": -17.39,
  "longitude": -66.16,
  "temporal": "daily",
  "start": "2024-09-01",
  "end": "2024-09-03",
  "parameters": ["T2M", "PRECTOTCORR", "RH2M"]
}
```

Respuesta:

```json
{
  "latitude": -17.39,
  "longitude": -66.16,
  "elevation": 2790.5,
  "parameters": {
    "T2M": {"units": "C", "longname": "Temperature at 2 Meters"},
    "PRECTOTCORR": {"units": "mm/day", "longname": "Precipitation Corrected"},
    "RH2M": {"units": "%", "longname": "Relative Humidity at 2 Meters"}
  },
  "data": {
    "T2M": {"20240901": 14.8, "20240902": 15.3, "20240903": 15.9},
    "PRECTOTCORR": {"20240901": 0.0, "20240902": 0.12, "20240903": null},
    "RH2M": {"20240901": 38.2, "20240902": 41.5, "20240903": 44.0}
  }
}
```

Un `null` indica que POWER devolvió `-999` (sin dato).

## 2. Lote pequeño con presets: Montero, Santa Cruz

`POST /api/power/polygon`

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[-63.26,-17.34],[-63.25,-17.34],[-63.25,-17.33],[-63.26,-17.33],[-63.26,-17.34]]]
  },
  "temporal": "daily",
  "start": "2024-01-01",
  "end": "2024-01-02",
  "presets": ["temperature", "soil_moisture"]
}
```

Respuesta (recortada). Un lote menor a una celda genera una sola consulta, en el centroide:

```json
{
  "query": {
    "temporal": "daily",
    "start": "2024-01-01",
    "end": "2024-01-02",
    "community": "ag",
    "parameters": ["T2M","T2M_MAX","T2M_MIN","T2M_RANGE","TS","T2MDEW","GWETTOP","GWETROOT","GWETPROF"],
    "grid_step": 0.5
  },
  "points_requested": 1,
  "points_ok": 1,
  "parameters": {"T2M": {"units": "C", "longname": "Temperature at 2 Meters"}},
  "aggregated": {
    "T2M": {"20240101": 26.4, "20240102": 25.9},
    "GWETROOT": {"20240101": 0.71, "20240102": 0.73}
  },
  "summary": {
    "T2M": {"min": 25.9, "max": 26.4, "mean": 26.15, "count": 2},
    "GWETROOT": {"min": 0.71, "max": 0.73, "mean": 0.72, "count": 2}
  },
  "points": null,
  "errors": []
}
```

## 3. Zona amplia con serie por punto: norte de Santa Cruz

Sirve para ver variación espacial. Con `include_points: true` se devuelve la serie de cada celda además del promedio.

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[-64.0,-18.0],[-62.5,-18.0],[-62.5,-16.8],[-64.0,-16.8],[-64.0,-18.0]]]
  },
  "temporal": "daily",
  "start": "2024-08-01",
  "end": "2024-08-31",
  "presets": ["precipitation"],
  "grid_step": 0.5,
  "include_points": true
}
```

Respuesta (resumida):

```json
{
  "points_requested": 7,
  "points_ok": 6,
  "aggregated": {"PRECTOTCORR": {"20240801": 0.4, "20240802": 0.0, "...": 0.0}},
  "summary": {"PRECTOTCORR": {"min": 0.0, "max": 6.2, "mean": 0.9, "count": 31}},
  "points": [
    {"latitude": -17.4, "longitude": -63.25, "elevation": 340.0, "parameters": {}, "data": {"PRECTOTCORR": {"20240801": 0.5}}}
  ],
  "errors": [
    {"latitude": -17.9, "longitude": -63.9, "detail": "The POWER Daily API is unreachable due too many requests are being submitted."}
  ]
}
```

Si algunos puntos fallan, la respuesta sigue siendo 200 con esos puntos en `errors`. Solo si fallan todos devuelve 502.

## 4. Histórico mensual: Beni (Trinidad), 2020 a 2023

```json
{
  "latitude": -14.83,
  "longitude": -64.90,
  "temporal": "monthly",
  "start": "2020-01-01",
  "end": "2023-12-31",
  "parameters": ["PRECTOTCORR", "T2M"]
}
```

Las claves son `YYYYMM` y la `YYYY13` es el promedio anual:

```json
{
  "data": {
    "PRECTOTCORR": {"202001": 9.8, "202002": 10.4, "...": 0.0, "202012": 8.9, "202013": 5.6},
    "T2M": {"202001": 27.1, "...": 0.0, "202013": 26.3}
  }
}
```

## 5. Climatología: altiplano, cerca de La Paz

Sin `start` y `end`, POWER usa su rango por defecto (2001 a 2025 según la documentación que enviaste).

```json
{
  "latitude": -16.5,
  "longitude": -68.15,
  "temporal": "climatology",
  "parameters": ["T2M", "PRECTOTCORR"]
}
```

Las claves `1` a `12` son los meses y `13` es el promedio anual:

```json
{
  "data": {
    "T2M": {"1": 9.6, "7": 5.1, "13": 7.4},
    "PRECTOTCORR": {"1": 3.5, "7": 0.2, "13": 1.6}
  }
}
```

## 6. Errores

Validación propia, 422, por ejemplo sin `parameters` ni `presets`:

```json
{
  "detail": [
    {
      "type": "value_error",
      "msg": "Value error, Indique 'parameters' o 'presets'"
    }
  ]
}
```

Parámetro inválido rechazado por POWER (el status se conserva en 422 y el mensaje viene de NASA):

```json
{"detail": ["<mensaje de validación de POWER>"]}
```

Con `curl` el caso 1 queda así:

```
curl -X POST http://localhost:8000/api/power/point -H "Content-Type: application/json" -d "{\"latitude\":-17.39,\"longitude\":-66.16,\"temporal\":\"daily\",\"start\":\"2024-09-01\",\"end\":\"2024-09-03\",\"parameters\":[\"T2M\",\"PRECTOTCORR\"]}"
```

Si quieres, el siguiente paso es un cliente de ejemplo para el frontend (fetch/axios) que envíe el polígono dibujado en el mapa.