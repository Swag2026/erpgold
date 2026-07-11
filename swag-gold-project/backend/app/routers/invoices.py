from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from ..core.database import get_db
from ..core.security import get_current_user
from ..models.invoice import Invoice, InvoiceItem
from ..models.activity_log import ActivityLog
from ..schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceResponse, CancelRequest

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


def _build_response(inv: Invoice) -> InvoiceResponse:
    from ..schemas.invoice import InvoiceItemResponse
    items = [
        InvoiceItemResponse(
            id=item.id,
            invoice_id=item.invoice_id,
            metal_type=item.metal_type,
            purity=item.purity,
            weight_grams=item.weight_grams,
            rate_per_gram=item.rate_per_gram,
            line_amount=item.line_amount,
            remarks=item.remarks,
        )
        for item in (inv.items or [])
    ]
    return InvoiceResponse(
        id=inv.id,
        invoice_no=inv.invoice_no,
        invoice_date=inv.invoice_date,
        category=inv.category,
        contact_id=inv.contact_id,
        weight_21k=inv.weight_21k,
        weight_18k=inv.weight_18k,
        weight_24k=inv.weight_24k,
        weight_silver=inv.weight_silver,
        amount_21k=inv.amount_21k,
        amount_18k=inv.amount_18k,
        amount_24k=inv.amount_24k,
        amount_silver=inv.amount_silver,
        cash_amount=inv.cash_amount,
        card_amount=inv.card_amount,
        total_amount=inv.total_amount,
        note=inv.note,
        description=inv.description,
        status=inv.status,
        validity=inv.validity,
        created_by_id=inv.created_by_id,
        updated_by_id=inv.updated_by_id,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
        items=items,
        contact_name=inv.contact.name if inv.contact else None,
        created_by_name=inv.created_by.full_name if inv.created_by else None,
        updated_by_name=inv.updated_by.full_name if inv.updated_by else None,
    )


@router.get("", response_model=List[InvoiceResponse])
def list_invoices(
    invoice_date: Optional[date] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    contact_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=5000),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Invoice)
    if invoice_date:
        q = q.filter(Invoice.invoice_date == invoice_date)
    if category:
        q = q.filter(Invoice.category == category)
    if status:
        q = q.filter(Invoice.status == status)
    if contact_id:
        q = q.filter(Invoice.contact_id == contact_id)
    if search:
        q = q.filter(Invoice.invoice_no.ilike(f"%{search}%"))
    invoices = q.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()
    return [_build_response(inv) for inv in invoices]


@router.post("", response_model=InvoiceResponse, status_code=201)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Check duplicate invoice_no
    existing = db.query(Invoice).filter(Invoice.invoice_no == payload.invoice_no).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Invoice number '{payload.invoice_no}' already exists")

    data = payload.model_dump(exclude={"items"})
    inv = Invoice(**data, created_by_id=current_user.id, status="active", validity="Original")
    db.add(inv)
    db.flush()

    for item_data in (payload.items or []):
        item = InvoiceItem(**item_data.model_dump(), invoice_id=inv.id)
        db.add(item)

    # Activity log
    log = ActivityLog(
        action_type="add",
        invoice_ref=inv.invoice_no,
        category=inv.category,
        amount=inv.total_amount,
        user_id=current_user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(inv)
    return _build_response(inv)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _build_response(inv)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role.name == "cashier":
        raise HTTPException(status_code=403, detail="Cashiers cannot edit invoices")
    if current_user.role.name == "supervisor" and not payload.note:
        raise HTTPException(status_code=422, detail="Supervisors must provide a note when editing")

    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == "canceled":
        raise HTTPException(status_code=400, detail="Cannot edit a canceled invoice")

    update_data = payload.model_dump(exclude={"items"}, exclude_unset=True)
    for field, val in update_data.items():
        setattr(inv, field, val)
    inv.validity = "Edited"
    inv.updated_by_id = current_user.id

    if payload.items is not None:
        db.query(InvoiceItem).filter(InvoiceItem.invoice_id == inv.id).delete()
        for item_data in payload.items:
            item = InvoiceItem(**item_data.model_dump(), invoice_id=inv.id)
            db.add(item)

    log = ActivityLog(
        action_type="edit",
        invoice_ref=inv.invoice_no,
        category=inv.category,
        amount=inv.total_amount,
        note=payload.note,
        user_id=current_user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(inv)
    return _build_response(inv)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
def cancel_invoice(
    invoice_id: int,
    payload: CancelRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role.name == "cashier":
        raise HTTPException(status_code=403, detail="Cashiers cannot cancel invoices")
    if current_user.role.name == "supervisor" and not payload.note:
        raise HTTPException(status_code=422, detail="Supervisors must provide a note when canceling")

    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == "canceled":
        raise HTTPException(status_code=400, detail="Invoice is already canceled")

    inv.status = "canceled"
    inv.note = payload.note or inv.note
    inv.updated_by_id = current_user.id

    log = ActivityLog(
        action_type="cancel",
        invoice_ref=inv.invoice_no,
        category=inv.category,
        amount=inv.total_amount,
        note=payload.note,
        user_id=current_user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(inv)
    return _build_response(inv)
