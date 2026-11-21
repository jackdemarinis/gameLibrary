"""Game Library server: the room-code relay plus the built frontend.

Run locally:  .venv/bin/uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import config
from app.routers import rooms


def createApp() -> FastAPI:
    app = FastAPI(title="Game Library", docs_url=None, redoc_url=None)
    app.include_router(rooms.router)

    @app.get("/api/health")
    def health() -> dict:
        return {"ok": True, "rooms": len(rooms.registry.rooms)}

    # The built Vite site. Mounted last so the routes above win.
    if config.staticDir.is_dir():
        app.mount("/", StaticFiles(directory=config.staticDir, html=True), name="site")
    return app


app = createApp()
