from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.routers import auth, artwork, shows, seasons, episodes, admin, catalog

app = FastAPI(title="Peblo TV API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(",") if hasattr(settings, "cors_origins") else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.storage_local_path, exist_ok=True)
app.mount("/storage", StaticFiles(directory=settings.storage_local_path), name="storage")

app.include_router(auth.router)
app.include_router(artwork.router)
app.include_router(shows.router)
app.include_router(seasons.router)
app.include_router(episodes.router)
app.include_router(admin.router)
app.include_router(catalog.router)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
