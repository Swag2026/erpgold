from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("invoice_no", "category", name="uq_invoice_no_category"),
    )

    id = Column(Integer, primary_key=True, index=True)
    invoice_no = Column(String(100), nullable=False, index=True)
    invoice_date = Column(Date, nullable=False)
    category = Column(String(50), nullable=False)  # sale, purchase_jewelry, purchase_scrap, supplier_payment, expense

    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)

    # Karat weights (grams)
    weight_21k = Column(Float, default=0.0)
    weight_18k = Column(Float, default=0.0)
    weight_24k = Column(Float, default=0.0)
    weight_silver = Column(Float, default=0.0)

    # Karat amounts (SAR)
    amount_21k = Column(Float, default=0.0)
    amount_18k = Column(Float, default=0.0)
    amount_24k = Column(Float, default=0.0)
    amount_silver = Column(Float, default=0.0)

    # Payment
    cash_amount = Column(Float, default=0.0)
    card_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)

    # Metadata
    status = Column(String(20), default="active")  # active, canceled
    validity = Column(String(20), default="Original")  # Original, Edited
    note = Column(Text)
    description = Column(Text)

    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    contact = relationship("Contact", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="invoices_created")
    updated_by = relationship("User", foreign_keys=[updated_by_id], back_populates="invoices_updated")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    metal_type = Column(String(20))  # gold, silver
    purity = Column(String(10))       # 24K, 21K, 18K, Silver
    weight_grams = Column(Float, default=0.0)
    rate_per_gram = Column(Float, default=0.0)
    line_amount = Column(Float, default=0.0)
    remarks = Column(Text)

    invoice = relationship("Invoice", back_populates="items")
