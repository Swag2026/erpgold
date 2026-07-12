from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.security import verify_password, create_access_token, get_current_user
from ..models.user import User
from ..schemas.auth import LoginRequest, TokenResponse, UserMe

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 5


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username, User.is_active == True).first()

    # Generic invalid-credentials response either way — never reveal whether
    # the username exists.
    invalid_creds = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
    )

    if user and user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
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
        raise invalid_creds

    # Successful login — clear any lockout state
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

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
