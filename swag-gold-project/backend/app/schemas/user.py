from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

ALLOWED_ROLES = {"cashier", "supervisor", "admin"}


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    full_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    role: str  # cashier | supervisor | admin

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ALLOWED_ROLES:
            raise ValueError(f"role must be one of: {', '.join(sorted(ALLOWED_ROLES))}")
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        v = v.strip()
        if not v.replace("_", "").replace(".", "").isalnum():
            raise ValueError("username may only contain letters, numbers, dots and underscores")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v is not None and v not in ALLOWED_ROLES:
            raise ValueError(f"role must be one of: {', '.join(sorted(ALLOWED_ROLES))}")
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
