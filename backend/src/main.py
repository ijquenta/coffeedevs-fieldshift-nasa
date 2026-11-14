from fastapi import FastAPI
from src.core.config import settings
from src.controllers.ml_controller import router as ml_router

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

app.include_router(ml_router, prefix=settings.API_PREFIX)

@app.get("/")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
