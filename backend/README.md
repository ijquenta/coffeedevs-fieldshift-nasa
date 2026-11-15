# FieldShift - Backend Copiloto Agronómico (NASA Space Apps)

Backend simple y legible para el **Chat Conversacional Multi-Turno** del copiloto agronómico de **FieldShift**, desarrollado con **Python 3.11+**, **FastAPI** y el SDK oficial `google-genai` (`gemini-3.1-flash-lite`).

---

## 🏛️ Estructura y Principios SOLID

Cada archivo tiene una única responsabilidad. Los contratos son `Protocol` simples, sin clases abstractas de más:

```
backend/
├── src/
│   ├── controllers/
│   │   ├── __init__.py              # api_router
│   │   └── chat_controller.py       # Endpoints /api/v1/chat
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                # Configuración desde .env
│   │   └── dependencies.py          # Inyección de dependencias
│   ├── domain/
│   │   ├── __init__.py
│   │   └── exceptions.py            # Errores de dominio
│   ├── interfaces/
│   │   ├── __init__.py
│   │   ├── ai_chat_provider.py      # ChatProvider (Protocol)
│   │   ├── chat_session_store.py    # ChatSessionStore (Protocol)
│   │   └── field_repository.py      # FieldRepository (Protocol)
│   ├── infrastructure/
│   │   ├── __init__.py
│   │   ├── gemini_chat_provider.py  # GeminiProvider (SDK google-genai)
│   │   ├── in_memory_session_store.py # InMemorySessionStore
│   │   └── mock_field_repository.py # MockFieldRepository (datos satelitales)
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── chat.py                  # Modelos Pydantic
│   ├── services/
│   │   ├── __init__.py
│   │   └── agronomist_chat_service.py # AgronomistChatService
│   ├── ml/
│   │   └── __init__.py
│   ├── main.py                      # App FastAPI, CORS, errores y /health
│   └── __init__.py
├── tests/
│   └── test_chat_module.py          # 11 tests unitarios y de integración
├── scripts/
│   └── chat_cli.py                  # Cliente de terminal interactivo
├── requirements.txt
├── .env.example
└── README.md
```

### Cómo se aplican los principios:
- **SRP**: cada archivo hace una sola cosa (`chat_controller` = HTTP, `agronomist_chat_service` = lógica, `GeminiProvider` = SDK, `InMemorySessionStore` = almacenamiento, `MockFieldRepository` = datos).
- **OCP**: agregas parcelas con `MockFieldRepository.register_plot()` o cambias `GeminiProvider` por otro proveedor sin tocar `AgronomistChatService`.
- **LSP**: `GeminiProvider` cumple el contrato `ChatProvider`, por lo que cualquier implementación equivalente es intercambiable.
- **ISP**: cada `Protocol` solo define los métodos que su consumidor realmente usa.
- **DIP**: `AgronomistChatService` recibe sus dependencias por constructor y `core/dependencies.py` las inyecta con FastAPI. No instancia nada por su cuenta.

---

## 🛰️ Datos Satelitales Integrados en el Contexto

1. **NASA SMAP**: Humedad volumétrica superficial (`0.14 m³/m³`) y déficit en zona radicular (`-18%` en `plot-altiplano-01`).
2. **NASA POWER**: Clima histórico, temperatura mínima crítica (`-6.2°C`) y ventana estacional de riesgo de heladas (Mayo-Agosto).
3. **NASA SRTM**: Elevación topográfica (`3820 m.s.n.m.`), porcentaje de pendiente (`6%`) y riesgo de erosión.
4. **Copernicus Sentinel-2**: Índice NDVI actual (`0.18`), meses críticos de suelo desnudo (Agosto a Octubre) y cobertura vegetal (`14.5%`).
5. **3 Estrategias de Rotación Comparadas**:
   - *Línea Base*: Monocultivo de Papa con suelo expuesto en invierno.
   - *Conservación Agua/Suelo*: Papa -> Cobertura invernal (*Vicia villosa* + Avena) -> Quinua acolchada.
   - *Nutrientes/Ingresos*: Papa -> Haba criolla (fijación biológica de N) -> Quinua real.

---

## 🚀 Instalación y Puesta en Marcha

### 1. Activar Entorno Virtual e Instalar Dependencias
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configurar Variables de Entorno
Copia `.env.example` a `.env` y define tu clave de Google Gemini:
```bash
cp .env.example .env
```
Contenido de `.env`:
```env
GEMINI_API_KEY=AIzaSy...tu_clave_real...
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TEMPERATURE=0.3
PROJECT_NAME="FieldShift - Agronomic Copilot API"
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

### 3. Iniciar el Servidor
```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

- **Swagger interactivo**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🧪 Ejecución de Pruebas Automatizadas

La suite incluye 11 pruebas unitarias y de integración que validan modelos, persistencia y endpoints:

```bash
python -m unittest tests/test_chat_module.py
```

---

## 📡 Endpoints del API

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/power/polygon/recommendation` | Consulta NASA POWER y devuelve `recommendation` (Markdown detallado) y `audio_summary` (resumen sencillo para voz) |
| `GET` | `/api/v1/ine/la-paz/municipios/nombre/{nombre_municipio}` | Obtiene el detalle de un municipio de La Paz por nombre |
| `GET` | `/api/v1/ine/la-paz/cultivos` | Lista todos los cultivos registrados y los municipios asociados |
| `GET` | `/api/v1/ine/la-paz/cultivos/{cultivo}` | Obtiene un cultivo y los municipios asociados |
| `POST` | `/api/v1/chat/message` | Envía mensaje al copiloto (crea o continúa hilo) |
| `GET` | `/api/v1/chat/{session_id}/history` | Obtiene el historial completo de la conversación |
| `DELETE` | `/api/v1/chat/{session_id}` | Cierra y elimina la sesión activa de memoria |
| `GET` | `/health` | Chequeo de salud del servicio |

El endpoint de recomendación recibe los mismos campos que `/api/power/polygon`, además de `plants` (obligatorio), `priorities`, `municipality_id`, `municipality_name`, `crop_requirements` y `current_crop` (opcionales). Solo admite resolución `daily` u `hourly`. El prompt de Gemini se carga desde `docs/prompt.md`.

La búsqueda municipal por nombre no distingue mayúsculas ni tildes. Codifica los espacios y caracteres especiales en la URL; por ejemplo: `GET /api/v1/ine/la-paz/municipios/nombre/Nuestra%20Se%C3%B1ora%20de%20La%20Paz`. Devuelve el mismo objeto que la búsqueda por ID o `404` si no existe.