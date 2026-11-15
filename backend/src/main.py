from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.controllers.power_controller import router as power_router
from src.controllers.ine_controller import router as ine_router
from src.core.config import get_settings
from src.core.exceptions import PowerAPIError
from src.services.power_client import PowerClient
from src.services.power_service import PowerService


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    client = PowerClient(settings)
    app.state.power_service = PowerService(client, settings)
    yield
    await client.aclose()


app = FastAPI(title="FieldShift Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(PowerAPIError)
async def power_error_handler(_: Request, exc: PowerAPIError):
    status = exc.status_code if exc.status_code in (422, 429, 503, 504) else 502
    return JSONResponse(status_code=status, content={"detail": exc.detail})


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(power_router)
app.include_router(ine_router)
