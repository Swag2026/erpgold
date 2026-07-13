from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class InvoiceItemBase(BaseModel):
    metal_type: Optional[str] = None
    purity: Optional[str] = None
    weight_grams: float = 0.0
    rate_per_gram: float = 0.0
    line_amount: float = 0.0
    remarks: Optional[str] = None


class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemResponse(InvoiceItemBase):
    id: int
    invoice_id: int

    model_config = {"from_attributes": True}


class InvoiceBase(BaseModel):
    invoice_no: str
    invoice_date: date
    category: str  # sale, purchase_jewelry, purchase_scrap, supplier_payment, expense
    contact_id: Optional[int] = None
    weight_21k: float = 0.0
    weight_18k: float = 0.0
    weight_24k: float = 0.0
    weight_silver: float = 0.0
    amount_21k: float = 0.0
    amount_18k: float = 0.0
    amount_24k: float = 0.0
    amount_silver: float = 0.0
    cash_amount: float = 0.0
    card_amount: float = 0.0
    total_amount: float = 0.0
    note: Optional[str] = None
    description: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    items: Optional[List[InvoiceItemCreate]] = []


class InvoiceUpdate(BaseModel):
    invoice_no: Optional[str] = None
    invoice_date: Optional[date] = None
    category: Optional[str] = None
    contact_id: Optional[int] = None
    weight_21k: Optional[float] = None
    weight_18k: Optional[float] = None
    weight_24k: Optional[float] = None
    weight_silver: Optional[float] = None
    amount_21k: Optional[float] = None
    amount_18k: Optional[float] = None
    amount_24k: Optional[float] = None
    amount_silver: Optional[float] = None
    cash_amount: Optional[float] = None
    card_amount: Optional[float] = None
    total_amount: Optional[float] = None
    note: Optional[str] = None
    description: Optional[str] = None
    items: Optional[List[InvoiceItemCreate]] = None


class CancelRequest(BaseModel):
    note: Optional[str] = None


class InvoiceResponse(InvoiceBase):
    id: int
    status: str
    validity: str
    created_by_id: int
    updated_by_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[InvoiceItemResponse] = []
    contact_name: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    model_config = {"from_attributes": True}
