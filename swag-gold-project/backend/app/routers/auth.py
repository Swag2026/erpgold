from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.security import verify_password, create_access_token, get_current_user
from ..models.user import User
from ..schemas.auth import LoginRequest, TokenResponse, UserMe
import time
from collections import defaultdict
import threading

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ════════════════════════════════════════════════════════
#  Simple in-memory rate limiter
#  — 5 failed attempts per 300 seconds (5 min) per IP
# ════════════════════════════════════════════════════════
_login_attempts: dict = defaultdict(list)   # { ip: [timestamp, ...] }
_lock = threading.Lock()
MAX_ATTEMPTS  = 5
WINDOW_SECONDS = 300  # 5 minutes


def _get_client_ip(request: Request) -> str:
    """Respect X-Forwarded-For set by Railway / Netlify proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return getattr(request.client, "host", "unknown")


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    with _lock:
        # Purge expired timestamps
        _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < WINDOW_SECONDS]
        if len(_login_attempts[ip]) >= MAX_ATTEMPTS:
            wait = int(WINDOW_SECONDS - (now - _login_attempts[ip][0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed login attempts. Try again in {wait} seconds.",
                headers={"Retry-After": str(wait)},
            )


def _record_attempt(ip: str) -> None:
    with _lock:
        _login_attempts[ip].append(time.time())


def _clear_attempts(ip: str) -> None:
    with _lock:
        _login_attempts.pop(ip, None)


# ════════════════════════════════════════════════════════
#  Routes
# ════════════════════════════════════════════════════════

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = _get_client_ip(request)
    _check_rate_limit(ip)                          # ← raises 429 if too many attempts

    user = (
        db.query(User)
        .filter(User.username == payload.username, User.is_active == True)
        .first()
    )
    if not user or not verify_password(payload.password, user.hashed_password):
        _record_attempt(ip)                        # ← count only failed attempts
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    _clear_attempts(ip)                            # ← reset counter on success
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role.name,
    )


@router.get("/me", response_model=UserMe)
def me(current_user=Depends(get_current_user)):
    return UserMe(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role.name,
        is_active=current_user.is_active,
    )
