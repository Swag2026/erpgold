from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.security import verify_password, hash_password, create_access_token, get_current_user
from ..models.user import User
from ..models.login_attempt import LoginAttempt
from ..schemas.auth import (
    LoginRequest, TokenResponse, UserMe, ChangePasswordRequest, LoginAttemptResponse, ProfileUpdate,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 5


def _client_ip(request: Request) -> str:
    # Railway (and most PaaS) sit behind a proxy — the real client IP is in
    # X-Forwarded-For, not request.client.host (which would be the proxy).
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _log_attempt(db: Session, username: str, success: bool, ip: str, reason: str = None):
    db.add(LoginAttempt(username=username, success=success, ip_address=ip, reason=reason))
    db.commit()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    user = db.query(User).filter(User.username == payload.username, User.is_active == True).first()

    # Generic invalid-credentials response either way — never reveal whether
    # the username exists.
    invalid_creds = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
    )

    if user and user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
        _log_attempt(db, payload.username, False, ip, "locked")
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Too many failed attempts. Try again in {remaining} minute(s).",
        )

    if not user or not verify_password(payload.password, user.hashed_password):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
                user.failed_login_attempts = 0
            db.commit()
        _log_attempt(db, payload.username, False, ip, "invalid_password")
        raise invalid_creds

    # Successful login — clear any lockout state
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    _log_attempt(db, payload.username, True, ip)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role.name,
        must_change_password=user.must_change_password,
        avatar=user.avatar,
    )


@router.get("/me", response_model=UserMe)
def me(current_user=Depends(get_current_user)):
    return UserMe(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role.name,
        is_active=current_user.is_active,
        must_change_password=current_user.must_change_password,
        avatar=current_user.avatar,
        email=current_user.email,
        phone=current_user.phone,
    )


@router.put("/profile", response_model=UserMe)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Self-service profile update — any logged-in user can edit their own
    name, email, phone, and profile picture (but not their role/username,
    which stay admin-controlled via /api/users)."""
    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.email is not None:
        current_user.email = payload.email.strip() or None
    if payload.phone is not None:
        current_user.phone = payload.phone.strip() or None
    if payload.avatar is not None:
        current_user.avatar = payload.avatar or None
    db.commit()
    db.refresh(current_user)
    return UserMe(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role.name,
        is_active=current_user.is_active,
        must_change_password=current_user.must_change_password,
        avatar=current_user.avatar,
        email=current_user.email,
        phone=current_user.phone,
    )


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"detail": "Password changed successfully"}


@router.get("/login-attempts", response_model=List[LoginAttemptResponse])
def list_login_attempts(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view login history")
    return (
        db.query(LoginAttempt)
        .order_by(LoginAttempt.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
