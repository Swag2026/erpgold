# Swag Gold — Exhibition Ledger

A full-stack jewelry exhibition ERP system with role-based access control, real-time analytics, audit trails, and a beautiful dark gold UI.

## Features

- **Dashboard** — live revenue/purchase summary, daily trend chart, balance breakdown
- **New Entry** — create sale, purchase (jewelry/scrap), supplier payment, or expense invoices
- **History** — full transaction ledger with filters, edit, and cancel
- **Activity Log** — immutable audit trail of all adds/edits/cancels
- **Analytics** — Chart.js charts: karat breakdown, cash vs card, daily trend, sales vs purchases
- **Reports** — daily and summary reports (printable)
- **Contacts Directory** — customers and suppliers with transaction history
- **Profit Calculator** — set cost rates per gram, see margin on every sale invoice
- **Settings** — exhibition configuration, JSON backup/restore
- **RBAC** — Cashier / Supervisor / Admin roles enforced in backend

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, Uvicorn |
| ORM | SQLAlchemy 2.0 |
| Migrations | Alembic |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Validation | Pydantic v2 |
| Database | PostgreSQL 16 |
| Frontend | HTML5 + Vanilla JS, Chart.js |

## Project Structure

```
swag-gold-project/
  backend/
    app/
      main.py            # FastAPI app, CORS, router mounting
      core/
        config.py        # Pydantic settings (.env)
        database.py      # SQLAlchemy engine + session
        security.py      # JWT, bcrypt, auth dependencies
      models/            # SQLAlchemy ORM models
      schemas/           # Pydantic request/response schemas
      routers/           # FastAPI route handlers
    alembic/             # Database migrations
    alembic.ini
    requirements.txt
    .env.example
    seed.py              # Seed roles, users, contacts, demo invoices
    Dockerfile
  frontend/
    index.html
    assets/
      css/style.css
      js/
        api.js           # Centralized API client
        auth.js          # Login/logout, session, role visibility
        app.js           # Navigation, utilities, entry point
        dashboard.js     # Dashboard view
        invoices.js      # New entry form, history, edit/cancel
        analytics.js     # Chart.js analytics view
        reports.js       # Daily and summary reports
        contacts.js      # Contacts directory
        profit.js        # Profit calculator
        settings.js      # Settings, backup, activity log
  docker-compose.yml
  .gitignore
  README.md
```

## Quick Start

### Option A — Docker Compose (recommended)

```bash
# Clone / unzip the project
cd swag-gold-project

# Start everything (PostgreSQL + API server)
docker compose up --build

# App will be available at: http://localhost:8000
```

### Option B — Local Python (no Docker)

**Requirements:** Python 3.11+, PostgreSQL running locally

```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
cd backend
pip install -r requirements.txt

# 3. Set up environment variables
cp .env.example .env
# Edit .env — set your PostgreSQL DATABASE_URL and a strong SECRET_KEY

# 4. Run migrations (creates all tables)
alembic upgrade head

# 5. Seed the database with roles, users, and demo data
python seed.py

# 6. Start the API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 7. Open the frontend
# Open frontend/index.html in your browser
# (or serve with: python -m http.server 3000 from the frontend/ directory)
```

### Option C — Running on Railway / Render / VPS

1. Push to GitHub.
2. Set the `DATABASE_URL` and `SECRET_KEY` environment variables in your platform.
3. Set the build command: `pip install -r backend/requirements.txt`
4. Set the start command: `cd backend && alembic upgrade head && python seed.py && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Serve the `frontend/` directory as static files (or let FastAPI serve it — it auto-detects the folder).

## Default Credentials (after seeding)

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin2026` |
| Supervisor | `supervisor` | `super2026` |
| Cashier | `cashier` | `cash2026` |

**Change these passwords immediately in production.**

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/swag_gold
SECRET_KEY=a-very-long-random-secret-key-at-least-32-chars
ACCESS_TOKEN_EXPIRE_MINUTES=480
ALGORITHM=HS256
```

## Role Permissions

| Feature | Cashier | Supervisor | Admin |
|---|:---:|:---:|:---:|
| Add new entries | ✅ | ✅ | ✅ |
| View history | ✅ | ✅ | ✅ |
| Edit entries | ❌ | ✅ (note req.) | ✅ |
| Cancel entries | ❌ | ✅ (note req.) | ✅ |
| Analytics | ❌ | ✅ | ✅ |
| Reports | ❌ | ✅ | ✅ |
| Profit Calculator | ❌ | ✅ | ✅ |
| Settings | ❌ | ❌ | ✅ |
| Backup / Restore | ❌ | ❌ | ✅ |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user info |
| GET/POST | `/api/contacts` | List / create contacts |
| PUT/DELETE | `/api/contacts/{id}` | Update / soft-delete |
| GET/POST | `/api/invoices` | List / create invoices |
| GET/PUT | `/api/invoices/{id}` | Get / update invoice |
| POST | `/api/invoices/{id}/cancel` | Cancel invoice |
| GET | `/api/analytics/summary` | Revenue/purchase totals |
| GET | `/api/analytics/daily-revenue` | Per-day breakdown |
| GET | `/api/analytics/karat-breakdown` | By purity |
| GET | `/api/analytics/cash-vs-card` | Payment method split |
| GET | `/api/cost-rates` | Cost rates per gram |
| POST/PUT | `/api/cost-rates` | Create/update rate |
| GET | `/api/activity-logs` | Audit trail |
| GET | `/api/reports/daily` | Daily report |
| GET | `/api/reports/summary` | Period summary |
| GET/PUT | `/api/settings` | App settings |
| GET | `/api/backup/export` | JSON backup download |
| GET | `/api/health` | Health check |

Full interactive docs: `http://localhost:8000/docs`

## License

MIT — use freely for any purpose.
