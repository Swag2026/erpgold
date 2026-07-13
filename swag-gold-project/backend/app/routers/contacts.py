from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from ..core.database import get_db
from ..core.security import get_current_user
from ..models.contact import Contact
from ..models.invoice import Invoice
from ..schemas.contact import ContactCreate, ContactUpdate, ContactResponse, ContactInvoiceSummary

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


def build_response(contact: Contact, db: Session) -> ContactResponse:
    active_invs = (
        db.query(Invoice)
        .filter(Invoice.contact_id == contact.id, Invoice.status == "active")
        .order_by(Invoice.invoice_date.desc())
        .all()
    )
    total_sales    = sum(i.total_amount or 0 for i in active_invs if i.category == "sale")
    total_purchase = sum(i.total_amount or 0 for i in active_invs if i.category in ("purchase_jewelry", "purchase_scrap"))
    total_all      = sum(i.total_amount or 0 for i in active_invs)

    inv_summaries = [
        ContactInvoiceSummary(
            id=i.id,
            invoice_no=str(i.invoice_no),
            invoice_date=str(i.invoice_date),
            category=i.category,
            total_amount=float(i.total_amount or 0),
        )
        for i in active_invs
    ]

    return ContactResponse(
        id=contact.id,
        name=contact.name,
        phone=contact.phone,
        email=contact.email,
        contact_type=contact.contact_type,
        city=contact.city,
        notes=contact.notes,
        is_active=contact.is_active,
        created_at=contact.created_at,
        updated_at=contact.updated_at,
        total_invoices=len(active_invs),
        total_amount=float(total_all),
        total_sales_amount=float(total_sales),
        total_purchase_amount=float(total_purchase),
        invoices=inv_summaries,
    )


@router.get("", response_model=List[ContactResponse])
def list_contacts(
    search: Optional[str] = Query(None),
    contact_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Contact).filter(Contact.is_active == True)
    if search:
        like = f"%{search}%"
        q = q.filter((Contact.name.ilike(like)) | (Contact.phone.ilike(like)))
    if contact_type and contact_type != "all":
        q = q.filter(Contact.contact_type == contact_type)
    contacts = q.order_by(Contact.name).all()
    return [build_response(c, db) for c in contacts]


@router.post("", response_model=ContactResponse, status_code=201)
def create_contact(
    payload: ContactCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    contact = Contact(**payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return build_response(contact, db)


@router.get("/{contact_id}", response_model=ContactResponse)
def get_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.is_active == True).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return build_response(contact, db)


@router.put("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: int,
    payload: ContactUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role.name == "cashier":
        raise HTTPException(status_code=403, detail="Cashiers cannot edit contacts")
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.is_active == True).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(contact, field, val)
    db.commit()
    db.refresh(contact)
    return build_response(contact, db)


@router.delete("/{contact_id}", status_code=204)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role.name not in ("supervisor", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.is_active == True).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact.is_active = False  # soft delete
    db.commit()
