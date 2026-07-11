from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..core.security import get_current_user, hash_password
from ..models.user import User, Role
from ..schemas.user import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_admin(current_user=Depends(get_current_user)):
    """Only admins can view or manage other users' accounts and permissions."""
    if current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage users")
    return current_user


def _to_response(u: User) -> UserResponse:
    return UserResponse(
        id=u.id,
        username=u.username,
        full_name=u.full_name,
        role=u.role.name,
        is_active=u.is_active,
        created_at=u.created_at,
        updated_at=u.updated_at,
    )


@router.get("", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), _=Depends(_require_admin)):
    users = db.query(User).order_by(User.created_at).all()
    return [_to_response(u) for u in users]


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Username '{payload.username}' is already taken")

    role = db.query(Role).filter(Role.name == payload.role).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{payload.role}' does not exist")

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
    return _to_response(user)


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

    # Prevent an admin from locking themselves out
    if user.id == current_user.id:
        if payload.is_active is False:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        if payload.role is not None and payload.role != "admin":
            raise HTTPException(status_code=400, detail="You cannot change your own role away from admin")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        role = db.query(Role).filter(Role.name == payload.role).first()
        if not role:
            raise HTTPException(status_code=400, detail=f"Role '{payload.role}' does not exist")
        user.role_id = role.id
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password:
        user.hashed_password = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return _to_response(user)


@router.delete("/{user_id}", status_code=204)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    """Soft-delete: deactivates the account instead of removing it, so past
    invoices/activity logs still show who created/edited them."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.commit()
