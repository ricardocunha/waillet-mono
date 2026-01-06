from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
from ..services.simulation_service import SimulationService

router = APIRouter(prefix="/simulate", tags=["simulation"])
logger = logging.getLogger(__name__)


class SimulationRequest(BaseModel):
    from_address: str
    to: str
    value: str  # in wei as hex string
    data: Optional[str] = "0x"
    chain: str
    token: Optional[str] = None


class BalanceChange(BaseModel):
    address: str
    token: str
    change: str  # formatted as "+0.5" or "-0.5"


class EventLog(BaseModel):
    name: str
    args: Dict[str, Any]
    address: str


class SimulationResponse(BaseModel):
    success: bool
    balance_changes: List[BalanceChange] = []
    events: List[EventLog] = []
    gas_used: int = 0
    error: Optional[str] = None
    revert_reason: Optional[str] = None


@router.post("/transaction", response_model=SimulationResponse)
async def simulate_transaction(request: SimulationRequest) -> SimulationResponse:
    """
    Simulate a transaction

    Returns balance changes, events, gas estimate, and any errors.
    """
    try:
        logger.info(f"🔮 Simulating transaction on {request.chain}")
        logger.debug(f"   From: {request.from_address[:10]}...")
        logger.debug(f"   To: {request.to[:10]}...")
        logger.debug(f"   Value: {request.value}")

        service = SimulationService(request.chain)

        result = await service.simulate_transaction(
            from_address=request.from_address,
            to=request.to,
            value=request.value,
            data=request.data or "0x",
            token=request.token
        )

        if result["success"]:
            logger.info(f"✅ Simulation successful - Gas: {result['gas_used']:,}")
        else:
            error_msg = result.get('error', 'Unknown error')
            logger.warning(f"❌ Simulation failed: {error_msg}")

            # Return HTTP error for validation failures
            if "Invalid address" in error_msg or "invalid address" in error_msg.lower():
                raise HTTPException(status_code=400, detail=error_msg)

        return SimulationResponse(**result)

    except HTTPException:
        # Re-raise HTTP exceptions (don't catch them in the generic handler)
        raise
    except Exception as e:
        logger.error(f"❌ Simulation error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {str(e)}"
        )