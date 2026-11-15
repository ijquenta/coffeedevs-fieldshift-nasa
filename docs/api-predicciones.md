# Contrato de la API de Predicciones

La interfaz de Next.js usa una capa aislada en `frontend/src/services/predictions.ts`. Ningún componente realiza llamadas HTTP directamente. El modo de ejemplo está activo por defecto; al configurar `NEXT_PUBLIC_USE_MOCK=false`, el servicio envía peticiones al backend indicado por `NEXT_PUBLIC_API_BASE_URL`.

## Configuración

Copiar `frontend/.env.example` a `frontend/.env.local` y definir:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_MAX_PREDICTION_AREA_HA=500
```

Las variables `NEXT_PUBLIC_*` se incluyen en el bundle del navegador. No colocar claves de proveedor de IA ni secretos en ellas. La clave de IA debe permanecer en el backend.

## `POST /predict`

Request:

```json
{
  "polygon": {
    "type": "Feature",
    "properties": {},
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[-68.15, -16.56], [-68.14, -16.56], [-68.14, -16.57], [-68.15, -16.56]]]
    }
  },
  "dateFrom": "2026-11-14",
  "dateTo": "2026-12-14",
  "priorities": ["Agua disponible"],
  "currentRotation": ["Papa", "Cebada", "Descanso"]
}
```

Response: `PredictionResponse` from `frontend/src/types/predictions.ts`. It contains ranges with `min`, `max`, `p25`, `p75`, `unidad`, `confianza`, `motivoConfianza` and `senal`; the seven supported variables; a time series; ranked crops; three rotations; information gaps, risks, dataset sources and metadata. `metadatos.esDatoDeEjemplo` must be `false` for a real backend response. Range units may be `% vol.`, `mm`, `°C`, `%` or `% pendiente`.

The UI accepts these confidence values: `alta`, `media`, `baja`; and traffic-signal values: `favorable`, `atencion`, `riesgo`.

## `POST /analyze-product`

Request: same polygon/date fields as `/predict`, plus a free-text `product` string.

Response:

```json
{
  "producto": "Quinua",
  "requerimientos": { "agua": "...", "temperatura": "...", "suelo": "...", "ciclo": "..." },
  "compatibilidad": "media",
  "puntaje": 74,
  "razones_a_favor": ["..."],
  "riesgos": ["..."],
  "vacios_de_informacion": ["..."],
  "recomendaciones_practicas": ["..."],
  "confianza": "media",
  "aviso": "..."
}
```

## Comportamiento HTTP esperado

- `POST /predict` y `POST /analyze-product`, JSON de entrada y salida.
- CORS habilitado para el origen del frontend.
- Respuestas 4xx/5xx deben incluir un cuerpo legible para facilitar soporte; la interfaz muestra estado HTTP sin exponer detalles internos.
- Timeout del cliente: 20 segundos. El cambio de consulta aborta la anterior.
- El cliente valida el contrato en tiempo de ejecución. Una respuesta incompleta se informa como contrato inválido, sin pintarla como dato correcto.
- El endpoint de análisis debe llamar al proveedor de IA desde el servidor; la clave nunca debe llegar al navegador.

## Señales NASA representadas

La interfaz ilustra humedad del suelo (SMAP), precipitación (GPM IMERG), temperatura y demanda climática (NASA POWER), vegetación (MODIS/Landsat), relieve (SRTM) y señal regional de almacenamiento de agua (GRACE-FO). La resolución y las limitaciones específicas deben formar parte de los motivos de confianza que devuelva el backend.
