from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .routers import auth, contacts, invoices, analytics, cost_rates, activity_logs, settings, reports, backup, users, day_openings
from .core.database import Base, engine
from .core.config import get_settings

# Create all tables (use Alembic in production)
Base.metadata.create_all(bind=engine)

_settings = get_settings()

app = FastAPI(
    title="Swag Gold — Exhibition Ledger API",
    version="1.0.0",
    description="Full-stack jewelry exhibition ERP with RBAC, analytics, and audit trails",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    # allow_credentials must be False when origins is "*" — the two are
    # mutually exclusive per the CORS spec. We use Bearer tokens, not
    # cookies, so this has no effect on the app either way.
    allow_credentials=_settings.cors_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(contacts.router)
app.include_router(invoices.router)
app.include_router(analytics.router)
app.include_router(cost_rates.router)
app.include_router(activity_logs.router)
app.include_router(settings.router)
app.include_router(reports.router)
app.include_router(backup.router)
app.include_router(users.router)
app.include_router(day_openings.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Swag Gold API"}


# Serve frontend static files if they exist alongside backend
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="static")

    @app.get("/", include_in_schema=False)
    def serve_frontend():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        filepath = os.path.join(FRONTEND_DIR, full_path)
        if os.path.isfile(filepath):
            return FileResponse(filepath)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
