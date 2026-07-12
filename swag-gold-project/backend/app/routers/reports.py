from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date
from ..core.database import get_db
from ..core.security import get_current_user
from ..models.invoice import Invoice
from fastapi import HTTPException

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _require_reports(current_user=Depends(get_current_user)):
    if current_user.role.name == "cashier":
        raise HTTPException(status_code=403, detail="Cashiers cannot access reports")
    return current_user


@router.get("/daily")
def daily_report(
    report_date: date = Query(...),
    db: Session = Depends(get_db),
    _=Depends(_require_reports),
):
    invoices = db.query(Invoice).filter(
        Invoice.invoice_date == report_date,
        Invoice.status == "active",
    ).order_by(Invoice.created_at).all()

    sales = [i for i in invoices if i.category == "sale"]
    purchases = [i for i in invoices if i.category in ("purchase_jewelry", "purchase_scrap")]
    payments = [i for i in invoices if i.category == "supplier_payment"]
    expenses = [i for i in invoices if i.category == "expense"]

    def _sum(items, field):
        return sum(getattr(i, field, 0) or 0 for i in items)

    return {
        "date": str(report_date),
        "summary": {
            "total_revenue": _sum(sales, "total_amount"),
            "total_purchases": _sum(purchases, "total_amount"),
            "total_expenses": _sum(expenses, "total_amount"),
            "total_payments": _sum(payments, "total_amount"),
            "cash_in": _sum(sales, "cash_amount"),
            "card_in": _sum(sales, "card_amount"),
            "net_cash": _sum(sales, "cash_amount") - _sum(purchases, "cash_amount") - _sum(expenses, "cash_amount"),
        },
        "sales": [
            {
                "invoice_no": i.invoice_no,
                "contact": i.contact.name if i.contact else None,
                "total": i.total_amount,
                "cash": i.cash_amount,
                "card": i.card_amount,
                "weight_21k": i.weight_21k,
                "weight_18k": i.weight_18k,
                "weight_24k": i.weight_24k,
                "weight_silver": i.weight_silver,
            }
            for i in sales
        ],
        "purchases": [
            {
                "invoice_no": i.invoice_no,
                "category": i.category,
                "contact": i.contact.name if i.contact else None,
                "total": i.total_amount,
            }
            for i in purchases
        ],
        "expenses": [
            {
                "invoice_no": i.invoice_no,
                "description": i.description,
                "total": i.total_amount,
            }
            for i in expenses
        ],
    }


@router.get("/summary")
def summary_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(_require_reports),
):
    q = db.query(Invoice).filter(Invoice.status == "active")
    if start_date:
        q = q.filter(Invoice.invoice_date >= start_date)
    if end_date:
        q = q.filter(Invoice.invoice_date <= end_date)

    invoices = q.all()
    sales = [i for i in invoices if i.category == "sale"]
    purchases = [i for i in invoices if i.category in ("purchase_jewelry", "purchase_scrap")]

    return {
        "period": {"start": str(start_date) if start_date else None, "end": str(end_date) if end_date else None},
        "total_revenue": sum(i.total_amount for i in sales),
        "total_purchases": sum(i.total_amount for i in purchases),
        "total_invoices": len(invoices),
        "sale_invoices": len(sales),
        "total_gold_grams": sum(i.weight_21k + i.weight_18k + i.weight_24k for i in sales),
    }
