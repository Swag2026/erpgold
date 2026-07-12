from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..core.security import get_current_user
from ..models.app_setting import AppSetting
from ..schemas.setting import SettingResponse, BulkSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=List[SettingResponse])
def get_settings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access settings")
    return db.query(AppSetting).all()


@router.put("", response_model=List[SettingResponse])
def update_settings(
    payload: BulkSettingsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update settings")
    for key, value in payload.settings.items():
        setting = db.query(AppSetting).filter(AppSetting.key == key).first()
        if setting:
            setting.value = str(value)
        else:
            db.add(AppSetting(key=key, value=str(value)))
    db.commit()
    return db.query(AppSetting).all()
