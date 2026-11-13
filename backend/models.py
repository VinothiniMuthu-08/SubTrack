from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from database import Base


# Subscription Table
class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    billing = Column(String, nullable=False)
    date = Column(String, nullable=False)
    icon = Column(String)
    color = Column(String)


# Payment History Table
class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)

    subscription_id = Column(
        Integer,
        ForeignKey("subscriptions.id"),
        nullable=False
    )

    amount = Column(Float, nullable=False)
    payment_date = Column(Date, nullable=False)