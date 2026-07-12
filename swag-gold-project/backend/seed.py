"""
seed.py — populate the database with initial roles, users, contacts, cost rates, and demo invoices.

Usage:
    cd backend
    python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date, timedelta
from app.core.database import SessionLocal, engine
from app.core.database import Base
from app.core.security import hash_password
from app.models.user import Role, User
from app.models.contact import Contact
from app.models.invoice import Invoice
from app.models.cost_rate import CostRate
from app.models.app_setting import AppSetting

Base.metadata.create_all(bind=engine)

db = SessionLocal()


def seed():
    # ── Roles ──────────────────────────────────────────────
    role_defs = [
        ("cashier",    "Can add entries and view history. No edit/cancel/analytics/settings."),
        ("supervisor", "Full ledger access, edit/cancel with mandatory note. No settings."),
        ("admin",      "Full access including settings, backup/restore, and data reset."),
    ]
    roles = {}
    for name, desc in role_defs:
        r = db.query(Role).filter(Role.name == name).first()
        if not r:
            r = Role(name=name, description=desc)
            db.add(r)
            db.flush()
        roles[name] = r

    # ── Users ──────────────────────────────────────────────
    # Credentials match the quick-login buttons in the frontend HTML
    user_defs = [
        ("cashier",    "Badr bin Sheehon",  "cashier",    "cash2026"),
        ("supervisor", "Mohammed Adel",     "supervisor", "super2026"),
        ("admin",      "Tareq",             "admin",      "admin2026"),
    ]
    for username, full_name, role_name, password in user_defs:
        u = db.query(User).filter(User.username == username).first()
        if not u:
            u = User(
                username=username,
                full_name=full_name,
                hashed_password=hash_password(password),
                role_id=roles[role_name].id,
            )
            db.add(u)
    db.flush()

    admin_user = db.query(User).filter(User.username == "admin").first()

    # ── Contacts ──────────────────────────────────────────
    contact_defs = [
        ("Ahmed Al-Rashidi",  "+966 50 111 2222", "customer", "customer"),
        ("Sara Al-Ghamdi",    "+966 55 333 4444", "customer", "customer"),
        ("Al-Noor Jewelry Supply", "+966 12 555 6666", None, "supplier"),
        ("Gulf Gold Trading", "+966 11 777 8888", None, "supplier"),
        ("Khalid Al-Harbi",   "+966 50 999 0000", "customer", "both"),
    ]
    contacts = []
    for name, phone, email, ctype in contact_defs:
        c = db.query(Contact).filter(Contact.name == name).first()
        if not c:
            c = Contact(name=name, phone=phone, email=email, contact_type=ctype)
            db.add(c)
            db.flush()
        contacts.append(c)

    # ── Cost Rates ─────────────────────────────────────────
    rate_defs = [
        ("24", 320.00),
        ("21", 285.00),
        ("18", 245.00),
        ("silver", 4.50),
    ]
    for purity, cost in rate_defs:
        r = db.query(CostRate).filter(CostRate.purity == purity).first()
        if not r:
            db.add(CostRate(purity=purity, cost_per_gram=cost))

    # ── App Settings ───────────────────────────────────────
    setting_defs = {
        "exhibition_name": "Swag Gold Exhibition",
        "currency": "SAR",
        "tax_rate": "0",
        "show_profit_to": "admin,supervisor",
    }
    for key, val in setting_defs.items():
        s = db.query(AppSetting).filter(AppSetting.key == key).first()
        if not s:
            db.add(AppSetting(key=key, value=val))

    db.commit()
    db.refresh(admin_user)

    # ── Demo Invoices ──────────────────────────────────────
    today = date.today()
    yesterday = today - timedelta(days=1)

    demo_invoices = [
        # Day 1 - Yesterday
        {
            "invoice_no": "SG-001",
            "invoice_date": yesterday,
            "category": "sale",
            "contact_id": contacts[0].id,
            "weight_21k": 15.5,
            "weight_18k": 8.0,
            "amount_21k": 15.5 * 310,
            "amount_18k": 8.0 * 265,
            "cash_amount": 6920.0,
            "card_amount": 0.0,
            "total_amount": 15.5 * 310 + 8.0 * 265,
        },
        {
            "invoice_no": "SG-002",
            "invoice_date": yesterday,
            "category": "sale",
            "contact_id": contacts[1].id,
            "weight_21k": 22.0,
            "amount_21k": 22.0 * 310,
            "cash_amount": 3500.0,
            "card_amount": 3320.0,
            "total_amount": 22.0 * 310,
        },
        {
            "invoice_no": "SG-003",
            "invoice_date": yesterday,
            "category": "purchase_jewelry",
            "contact_id": contacts[2].id,
            "weight_21k": 30.0,
            "amount_21k": 30.0 * 280,
            "cash_amount": 8400.0,
            "card_amount": 0.0,
            "total_amount": 30.0 * 280,
        },
        # Day 2 - Today
        {
            "invoice_no": "SG-004",
            "invoice_date": today,
            "category": "sale",
            "contact_id": contacts[4].id,
            "weight_21k": 10.0,
            "weight_24k": 5.0,
            "amount_21k": 10.0 * 312,
            "amount_24k": 5.0 * 335,
            "cash_amount": 4795.0,
            "card_amount": 0.0,
            "total_amount": 10.0 * 312 + 5.0 * 335,
        },
        {
            "invoice_no": "SG-005",
            "invoice_date": today,
            "category": "sale",
            "contact_id": contacts[0].id,
            "weight_18k": 12.0,
            "weight_silver": 50.0,
            "amount_18k": 12.0 * 262,
            "amount_silver": 50.0 * 4.8,
            "cash_amount": 3384.0,
            "card_amount": 0.0,
            "total_amount": 12.0 * 262 + 50.0 * 4.8,
        },
        {
            "invoice_no": "SG-006",
            "invoice_date": today,
            "category": "purchase_scrap",
            "contact_id": contacts[3].id,
            "weight_21k": 8.5,
            "amount_21k": 8.5 * 278,
            "cash_amount": 2363.0,
            "card_amount": 0.0,
            "total_amount": 8.5 * 278,
        },
        {
            "invoice_no": "SG-007",
            "invoice_date": today,
            "category": "expense",
            "description": "Stall rental and electricity",
            "cash_amount": 500.0,
            "card_amount": 0.0,
            "total_amount": 500.0,
        },
    ]

    for inv_data in demo_invoices:
        existing = db.query(Invoice).filter(Invoice.invoice_no == inv_data["invoice_no"]).first()
        if not existing:
            inv = Invoice(**inv_data, created_by_id=admin_user.id, status="active", validity="Original")
            db.add(inv)

    db.commit()
    print("✅  Database seeded successfully.")
    print()
    print("Default user credentials:")
    print("  Admin      → username: admin       password: admin2026")
    print("  Supervisor → username: supervisor  password: super2026")
    print("  Cashier    → username: cashier     password: cash2026")


if __name__ == "__main__":
    seed()
