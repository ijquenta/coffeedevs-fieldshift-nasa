from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from src.controllers.power_controller import router as power_router
from src.controllers.ine_controller import router as ine_router
from src.controllers import api_router
from src.core.config import get_settings
from src.domain.exceptions import (
    AIProviderError,
    FieldNotFoundError,
    FieldShiftDomainException,
    SessionNotFoundError,
)

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "API del Copiloto Agronómico FieldShift - Chat multi-turno "
        "con Google GenAI (gemini-3.1-flash-lite) y datos satelitales NASA (SMAP, POWER, SRTM, Sentinel-2)."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(SessionNotFoundError)
async def session_not_found_handler(
    request: Request,
    exc: SessionNotFoundError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "SessionNotFound",
            "message": exc.message,
            "session_id": exc.session_id,
        },
    )


@app.exception_handler(FieldNotFoundError)
async def field_not_found_handler(
    request: Request,
    exc: FieldNotFoundError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "FieldNotFound",
            "message": exc.message,
            "field_id": exc.field_id,
        },
    )


@app.exception_handler(AIProviderError)
async def ai_provider_error_handler(
    request: Request,
    exc: AIProviderError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={
            "error": "AIProviderError",
            "message": exc.message,
            "detail": exc.detail,
        },
    )


@app.exception_handler(FieldShiftDomainException)
async def general_domain_exception_handler(
    request: Request,
    exc: FieldShiftDomainException,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "DomainError",
            "message": exc.message,
        },
    )


@app.get("/health", tags=["Salud"], status_code=status.HTTP_200_OK)
def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "model": settings.GEMINI_MODEL,
    }


app.include_router(power_router)
app.include_router(ine_router)
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
