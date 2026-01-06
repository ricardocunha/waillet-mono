from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from ..database import get_db
from ..models import Favorite
from ..services.ai_service import AIService


router = APIRouter(prefix="/ai", tags=["ai"])


class IntentRequest(BaseModel):
    prompt: str
    wallet_address: str


class IntentResponse(BaseModel):
    action: str
    to: str | None = None
    value: str | None = None
    token: str | None = None
    chain: str | None = None
    resolved_from: str | None = None
    confidence: int = 0
    error: str | None = None


@router.post("/parse-intent", response_model=IntentResponse)
def parse_intent(
    request: IntentRequest,
    db: Session = Depends(get_db)
):
    favorites = db.query(Favorite).filter(
        Favorite.wallet_address == request.wallet_address
    ).all()

    favorites_dict = [
        {
            "alias": fav.alias,
            "address": fav.address,
            "chain": fav.chain,
            "asset": fav.asset,
            "type": fav.type.value
        }
        for fav in favorites
    ]
    
    try:
        ai_service = AIService()
        result = ai_service.parse_intent(
            prompt=request.prompt,
            wallet_address=request.wallet_address,
            favorites=favorites_dict
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse intent: {str(e)}"
        )


