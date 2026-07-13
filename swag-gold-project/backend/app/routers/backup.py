import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.security import get_current_user
from ..models.invoice import Invoice, InvoiceItem
from ..models.contact import Contact
from ..models.activity_log import ActivityLog

router = APIRouter(prefix="/api/backup", tags=["backup"])


def _require_admin(current_user=Depends(get_current_user)):
    if current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can perform backup/restore")
    return current_user


@router.get("/export")
def export_backup(db: Session = Depends(get_db), _=Depends(_require_admin)):
    invoices = db.query(Invoice).all()
    contacts = db.query(Contact).filter(Contact.is_active == True).all()
    logs = db.query(ActivityLog).order_by(ActivityLog.timestamp.desc()).limit(1000).all()

    def _inv_dict(inv):
        return {
            "id": inv.id, "invoice_no": inv.invoice_no,
            "invoice_date": str(inv.invoice_date), "category": inv.category,
            "contact_id": inv.contact_id,
            "weight_21k": inv.weight_21k, "weight_18k": inv.weight_18k,
            "weight_24k": inv.weight_24k, "weight_silver": inv.weight_silver,
            "amount_21k": inv.amount_21k, "amount_18k": inv.amount_18k,
            "amount_24k": inv.amount_24k, "amount_silver": inv.amount_silver,
            "cash_amount": inv.cash_amount, "card_amount": inv.card_amount,
            "total_amount": inv.total_amount, "status": inv.status,
            "validity": inv.validity, "note": inv.note, "description": inv.description,
            "created_at": str(inv.created_at),
        }

    data = {
        "exported_at": str(__import__("datetime").datetime.utcnow()),
        "invoices": [_inv_dict(i) for i in invoices],
        "contacts": [
            {"id": c.id, "name": c.name, "phone": c.phone,
             "email": c.email, "contact_type": c.contact_type, "notes": c.notes}
            for c in contacts
        ],
        "activity_logs": [
            {"action_type": l.action_type, "invoice_ref": l.invoice_ref,
             "category": l.category, "amount": l.amount, "note": l.note,
             "timestamp": str(l.timestamp)}
            for l in logs
        ],
    }

    return JSONResponse(content=data, headers={
        "Content-Disposition": "attachment; filename=swag-gold-backup.json"
    })


@router.get("/health")
def health():
    return {"status": "ok"}
