from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
import calendar

from database import engine, Base, SessionLocal
import models


# Create database tables
Base.metadata.create_all(bind=engine)


# Create FastAPI app
app = FastAPI(title="SubTrack API")


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://sub-track-ashy-xi.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Database connection
def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# Subscription Schema
class SubscriptionCreate(BaseModel):
    name: str
    category: str
    price: float
    billing: str
    date: str
    icon: str = ""
    color: str = ""


# Payment Schema
class PaymentCreate(BaseModel):
    subscription_id: int
    amount: float
    payment_date: date


# HOME API
@app.get("/")
def home():
    return {
        "message": "Welcome to SubTrack Backend!",
        "status": "Running"
    }


# HEALTH CHECK API
@app.get("/health")
def health():
    return {
        "status": "Healthy"
    }


# GET - View all subscriptions
@app.get("/subscriptions")
def get_subscriptions(db: Session = Depends(get_db)):

    subscriptions = db.query(models.Subscription).all()

    return [
        {
            "id": sub.id,
            "name": sub.name,
            "category": sub.category,
            "price": sub.price,
            "billing": sub.billing,
            "date": sub.date,
            "icon": sub.icon,
            "color": sub.color
        }
        for sub in subscriptions
    ]


# POST - Add subscription
@app.post("/subscriptions")
def add_subscription(
    subscription: SubscriptionCreate,
    db: Session = Depends(get_db)
):

    new_subscription = models.Subscription(
        name=subscription.name,
        category=subscription.category,
        price=subscription.price,
        billing=subscription.billing,
        date=subscription.date,
        icon=subscription.icon,
        color=subscription.color
    )

    db.add(new_subscription)
    db.commit()
    db.refresh(new_subscription)

    return {
        "message": "Subscription added successfully",
        "subscription": {
            "id": new_subscription.id,
            "name": new_subscription.name,
            "category": new_subscription.category,
            "price": new_subscription.price,
            "billing": new_subscription.billing,
            "date": new_subscription.date,
            "icon": new_subscription.icon,
            "color": new_subscription.color
        }
    }


# PUT - Edit subscription
@app.put("/subscriptions/{subscription_id}")
def update_subscription(
    subscription_id: int,
    updated_data: SubscriptionCreate,
    db: Session = Depends(get_db)
):

    subscription = db.query(models.Subscription).filter(
        models.Subscription.id == subscription_id
    ).first()

    if not subscription:
        raise HTTPException(
            status_code=404,
            detail="Subscription not found"
        )

    subscription.name = updated_data.name
    subscription.category = updated_data.category
    subscription.price = updated_data.price
    subscription.billing = updated_data.billing
    subscription.date = updated_data.date
    subscription.icon = updated_data.icon
    subscription.color = updated_data.color

    db.commit()
    db.refresh(subscription)

    return {
        "message": "Subscription updated successfully",
        "subscription": {
            "id": subscription.id,
            "name": subscription.name,
            "category": subscription.category,
            "price": subscription.price,
            "billing": subscription.billing,
            "date": subscription.date,
            "icon": subscription.icon,
            "color": subscription.color
        }
    }


# DELETE - Delete subscription
@app.delete("/subscriptions/{subscription_id}")
def delete_subscription(
    subscription_id: int,
    db: Session = Depends(get_db)
):

    subscription = db.query(models.Subscription).filter(
        models.Subscription.id == subscription_id
    ).first()

    if not subscription:
        raise HTTPException(
            status_code=404,
            detail="Subscription not found"
        )

    # Delete related payment records first
    db.query(models.Payment).filter(
        models.Payment.subscription_id == subscription_id
    ).delete(synchronize_session=False)

    db.delete(subscription)
    db.commit()

    return {
        "message": "Subscription deleted successfully"
    }


# POST - Add payment and update next payment date
@app.post("/payments")
def add_payment(
    payment: PaymentCreate,
    db: Session = Depends(get_db)
):

    subscription = db.query(models.Subscription).filter(
        models.Subscription.id == payment.subscription_id
    ).first()

    if not subscription:
        raise HTTPException(
            status_code=404,
            detail="Subscription not found"
        )

    # Create payment record
    new_payment = models.Payment(
        subscription_id=payment.subscription_id,
        amount=payment.amount,
        payment_date=payment.payment_date
    )

    # Calculate next payment date
    payment_date = payment.payment_date

    if subscription.billing.lower() == "monthly":

        year = payment_date.year
        month = payment_date.month + 1

        if month > 12:
            month = 1
            year += 1

        day = min(
            payment_date.day,
            calendar.monthrange(year, month)[1]
        )

        next_date = date(year, month, day)

    elif subscription.billing.lower() == "yearly":

        year = payment_date.year + 1

        day = min(
            payment_date.day,
            calendar.monthrange(year, payment_date.month)[1]
        )

        next_date = date(
            year,
            payment_date.month,
            day
        )

    else:
        next_date = payment_date

    # Update subscription renewal date
    subscription.date = next_date.isoformat()

    # Save both changes
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    return {
        "message": "Payment recorded successfully",
        "payment": {
            "id": new_payment.id,
            "subscription_id": new_payment.subscription_id,
            "amount": new_payment.amount,
            "payment_date": new_payment.payment_date.isoformat()
        },
        "next_payment_date": subscription.date
    }


# GET - View payment history
@app.get("/payments")
def get_payments(db: Session = Depends(get_db)):

    payments = db.query(models.Payment).order_by(
        models.Payment.payment_date.desc()
    ).all()

    return [
        {
            "id": payment.id,
            "subscription_id": payment.subscription_id,
            "amount": payment.amount,
            "payment_date": payment.payment_date.isoformat()
        }
        for payment in payments
    ]