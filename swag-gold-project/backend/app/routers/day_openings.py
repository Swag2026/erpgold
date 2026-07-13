from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import date as date_type
from ..core.database import get_db
from ..core.security import get_current_user
from ..models.day_opening import DayOpening
from ..schemas.day_opening import DayOpeningUpsert, DayOpeningResponse

router = APIRouter(prefix="/api/day-openings", tags=["day-openings"])


@router.get("", response_model=List[DayOpeningResponse])
def list_day_openings(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return db.query(DayOpening).order_by(DayOpening.opening_date.asc()).all()


@router.put("/{opening_date}", response_model=DayOpeningResponse)
def upsert_day_opening(
    opening_date: date_type,
    payload: DayOpeningUpsert,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.query(DayOpening).filter(DayOpening.opening_date == opening_date).first()
    if not row:
        row = DayOpening(opening_date=opening_date)
        db.add(row)
    row.opening_cash = payload.opening_cash
    row.opening_gold = payload.opening_gold
    row.opening_silver = payload.opening_silver
    row.updated_by_id = current_user.id
    db.commit()
    db.refresh(row)
    return row
