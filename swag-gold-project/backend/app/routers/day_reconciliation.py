from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import date as date_type
from ..core.database import get_db
from ..core.security import get_current_user
from ..models.day_reconciliation import DayReconciliation
from ..schemas.day_reconciliation import ReconciliationUpsert, ReconciliationResponse

router = APIRouter(prefix="/api/reconciliations", tags=["reconciliations"])


def _build_response(r: DayReconciliation) -> ReconciliationResponse:
    return ReconciliationResponse(
        reconciliation_date=r.reconciliation_date,
        system_closing_cash=r.system_closing_cash,
        counted_cash=r.counted_cash,
        variance=r.variance,
        note=r.note,
        reconciled_by_name=r.reconciled_by.full_name if r.reconciled_by else None,
        reconciled_at=r.reconciled_at,
    )


@router.get("", response_model=List[ReconciliationResponse])
def list_reconciliations(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    rows = db.query(DayReconciliation).order_by(DayReconciliation.reconciliation_date.desc()).all()
    return [_build_response(r) for r in rows]


@router.put("/{reconciliation_date}", response_model=ReconciliationResponse)
def upsert_reconciliation(
    reconciliation_date: date_type,
    payload: ReconciliationUpsert,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.query(DayReconciliation).filter(DayReconciliation.reconciliation_date == reconciliation_date).first()
    if not row:
        row = DayReconciliation(reconciliation_date=reconciliation_date)
        db.add(row)
    row.system_closing_cash = payload.system_closing_cash
    row.counted_cash = payload.counted_cash
    row.variance = payload.counted_cash - payload.system_closing_cash
    row.note = payload.note
    row.reconciled_by_id = current_user.id
    db.commit()
    db.refresh(row)
    return _build_response(row)
