from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..core.security import get_current_user, hash_password
from ..models.user import User, Role
from ..schemas.user import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_admin(current_user=Depends(get_current_user)):
    if current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage users")
    return current_user


def _get_role_or_404(db: Session, role_name: str) -> Role:
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{role_name}' does not exist")
    return role


def _build_response(u: User) -> UserResponse:
    return UserResponse(
        id=u.id,
        username=u.username,
        full_name=u.full_name,
        role=u.role.name,
        is_active=u.is_active,
        created_at=u.created_at,
    )


@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    users = db.query(User).order_by(User.created_at.asc()).all()
    return [_build_response(u) for u in users]


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Username '{payload.username}' already exists")

    role = _get_role_or_404(db, payload.role)
    user = User(
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _build_response(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_self = user.id == current_user.id
    if is_self and (payload.role is not None or payload.is_active is False):
        raise HTTPException(status_code=400, detail="You cannot change your own role or disable your own account")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.password:
        user.hashed_password = hash_password(payload.password)
    if payload.role is not None:
        role = _get_role_or_404(db, payload.role)
        user.role_id = role.id
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return _build_response(user)


@router.delete("/{user_id}", status_code=204)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    """Soft-disable: keeps the user row (and all their invoices/activity log
    attribution) intact, just blocks future logins."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")

    user.is_active = False
    db.commit()
