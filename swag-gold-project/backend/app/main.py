from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
import os

from .routers import auth, contacts, invoices, analytics, cost_rates, activity_logs, settings, reports, backup, users
from .core.database import Base, engine

# Create all tables on startup (use Alembic in production migrations)
Base.metadata.create_all(bind=engine)

# ── Decide environment ─────────────────────────────────────────────────────
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"

app = FastAPI(
    title="Swag Gold — Exhibition Ledger API",
    version="1.0.0",
    description="Full-stack jewelry exhibition ERP with RBAC, analytics, and audit trails",
    # Hide interactive docs in production
    docs_url=None if IS_PRODUCTION else "/api/docs",
    redoc_url=None,
)

# ════════════════════════════════════════════════════════════
#  CORS — restrict to known origins
#  Set ALLOWED_ORIGINS env var (comma-separated) in production.
#  Example: https://your-app.netlify.app,https://yourdomain.com
# ════════════════════════════════════════════════════════════
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:8080,http://127.0.0.1:5500"
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)

# ════════════════════════════════════════════════════════════
#  Security headers — added to every response
# ════════════════════════════════════════════════════════════
@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"]  = "nosniff"
    response.headers["X-Frame-Options"]          = "DENY"
    response.headers["X-XSS-Protection"]         = "1; mode=block"
    response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]        = "geolocation=(), microphone=(), camera=()"
    # Content-Security-Policy — restrict script/style/font sources to self + the
    # specific CDNs the frontend actually uses (Chart.js, SheetJS, Google Fonts)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; "
        "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'"
    )
    # Don't advertise what server software we're running
    if "server" in response.headers:
        del response.headers["server"]
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


# ── Routers ────────────────────────────────────────────────────────────────
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


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Swag Gold API"}


# ── Serve frontend static files if bundled alongside backend ───────────────
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
