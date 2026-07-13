from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    full_name: str
    role: str
    must_change_password: bool = False
    avatar: Optional[str] = None


class UserMe(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool
    must_change_password: bool = False
    avatar: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None   # base64 data URI; frontend resizes before sending

    @field_validator("avatar")
    @classmethod
    def avatar_size_guard(cls, v: Optional[str]) -> Optional[str]:
        # A resized (~200x200) JPEG/PNG data URI should comfortably fit
        # under this. Guards against someone sending a huge original photo.
        if v is not None and len(v) > 400_000:
            raise ValueError("Image is too large — please use a smaller photo")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters long")
        return v


class LoginAttemptResponse(BaseModel):
    id: int
    username: str
    success: bool
    ip_address: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
