from sqlalchemy import Column, Integer, String, Enum, Boolean, Text, TIMESTAMP, func, Numeric
from .database import Base
import enum


class FavoriteType(str, enum.Enum):
    address = "address"
    contract = "contract"
    token = "token"


class PolicyType(str, enum.Enum):
    allowlist = "allowlist"
    spending_limit = "spending_limit"
    contract_block = "contract_block"


class Decision(str, enum.Enum):
    approved = "approved"
    blocked = "blocked"
    pending = "pending"


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    alias = Column(String(100), nullable=False)
    address = Column(String(42), nullable=False)
    chain = Column(String(50), nullable=True)  # Chain is optional - network is determined by context
    asset = Column(String(50), nullable=True)
    type = Column(Enum(FavoriteType), default=FavoriteType.address)
    value = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class Policy(Base):
    __tablename__ = "policies"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    policy_type = Column(Enum(PolicyType), nullable=False)
    target_address = Column(String(42), nullable=True)
    chain = Column(String(50), nullable=False)
    limit_amount = Column(Numeric(65, 18), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class RiskLog(Base):
    __tablename__ = "risk_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    tx_hash = Column(String(66), nullable=True)
    method = Column(String(100), nullable=False)
    params = Column(Text, nullable=True)
    risk_score = Column(Integer, default=0)
    ai_summary = Column(Text, nullable=True)
    decision = Column(Enum(Decision), default=Decision.pending)
    created_at = Column(TIMESTAMP, server_default=func.now())

