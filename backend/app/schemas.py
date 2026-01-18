from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from .models import FavoriteType, PolicyType, Decision


class FavoriteBase(BaseModel):
    wallet_address: str = Field(..., max_length=42)
    alias: str = Field(..., max_length=100)
    address: str = Field(..., max_length=42)
    chain: Optional[str] = Field(None, max_length=50)  # Chain is optional - network is determined by context
    asset: Optional[str] = Field(None, max_length=50)
    type: FavoriteType = FavoriteType.address
    value: Optional[str] = Field(None, max_length=255)


class FavoriteCreate(FavoriteBase):
    pass


class FavoriteUpdate(BaseModel):
    alias: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=42)
    chain: Optional[str] = Field(None, max_length=50)
    asset: Optional[str] = Field(None, max_length=50)
    type: Optional[FavoriteType] = None
    value: Optional[str] = Field(None, max_length=255)


class FavoriteResponse(FavoriteBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PolicyBase(BaseModel):
    wallet_address: str = Field(..., max_length=42)
    policy_type: PolicyType
    target_address: Optional[str] = Field(None, max_length=42)
    chain: str = Field(..., max_length=50)
    limit_amount: Optional[float] = None
    is_active: bool = True


class PolicyCreate(PolicyBase):
    pass


class PolicyResponse(PolicyBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class RiskLogBase(BaseModel):
    wallet_address: str = Field(..., max_length=42)
    tx_hash: Optional[str] = Field(None, max_length=66)
    method: str = Field(..., max_length=100)
    params: Optional[str] = None
    risk_score: int = 0
    ai_summary: Optional[str] = None
    decision: Decision = Decision.pending


class RiskLogCreate(RiskLogBase):
    pass


class RiskLogResponse(RiskLogBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


