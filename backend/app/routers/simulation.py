from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import json
from sqlalchemy.orm import Session
from ..services.simulation_service import SimulationService
from ..services.risk_service import RiskService
from ..services.ai_service import AIService
from ..database import get_db
from ..models import RiskLog, Decision

router = APIRouter(prefix="/simulate", tags=["simulation"])
logger = logging.getLogger(__name__)


class SimulationRequest(BaseModel):
    from_address: str
    to: str
    value: str  # wei as hex
    data: Optional[str] = "0x"
    chain: str
    token: Optional[str] = None


class BalanceChange(BaseModel):
    address: str
    token: str
    change: str  # "+0.5" or "-0.5"


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
    """Simulate transaction and return balance changes, events, gas used"""
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

            if "Invalid address" in error_msg or "invalid address" in error_msg.lower():
                raise HTTPException(status_code=400, detail=error_msg)

        return SimulationResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Simulation error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {str(e)}"
        )


# Risk analysis endpoints

class RiskAnalysisRequest(BaseModel):
    wallet_address: str
    to_address: str
    value: str  # wei as hex
    data: Optional[str] = "0x"
    chain: str


class RiskFactor(BaseModel):
    type: str
    severity: str
    title: str
    description: str
    points: int


class RiskRecommendation(BaseModel):
    icon: str
    text: str
    action: str


class RiskAnalysisResponse(BaseModel):
    risk_log_id: int
    risk_score: int
    risk_level: str
    ai_summary: str
    factors: List[RiskFactor]
    recommendations: List[RiskRecommendation]
    contract_info: Dict[str, Any]
    is_contract: bool
    value_usd: float


class RiskDecisionRequest(BaseModel):
    risk_log_id: int
    approved: bool
    tx_hash: Optional[str] = None


@router.post("/risk-analysis", response_model=RiskAnalysisResponse)
async def analyze_risk(
    request: RiskAnalysisRequest,
    db: Session = Depends(get_db)
) -> RiskAnalysisResponse:
    """
    Analyze transaction risk with heuristics + AI
    Returns score, level, summary, factors, recommendations, and log ID
    """
    try:
        logger.info(f"🔍 Risk analysis request for {request.chain}")
        logger.info(f"   Wallet: {request.wallet_address}")
        logger.info(f"   To: {request.to_address}")
        logger.info(f"   Value: {request.value}")
        logger.info(f"   Data: {request.data[:20] if request.data else '0x'}...")

        # Run risk analysis
        risk_service = RiskService(request.chain, db)
        analysis = await risk_service.analyze_transaction(
            from_address=request.wallet_address,
            to_address=request.to_address,
            value=request.value,
            data=request.data,
            wallet_address=request.wallet_address
        )

        # Generate AI explanation
        ai_service = AIService()
        ai_summary = ai_service.generate_risk_explanation(
            risk_analysis=analysis,
            to_address=request.to_address,
            value_usd=analysis.get("value_usd", 0)
        )

        # Save to database
        risk_log = RiskLog(
            wallet_address=request.wallet_address.lower(),
            tx_hash=None,  # Filled later if approved
            method="eth_sendTransaction",
            params=json.dumps({
                "to": request.to_address,
                "value": request.value,
                "data": request.data
            }),
            risk_score=analysis["risk_score"],
            ai_summary=ai_summary,
            decision=Decision.pending
        )
        db.add(risk_log)

        try:
            db.commit()
            logger.info(f"💾 Database commit successful")
        except Exception as commit_error:
            logger.error(f"❌ Database commit failed: {commit_error}")
            db.rollback()
            raise

        db.refresh(risk_log)

        logger.info(f"✅ Risk analysis complete - Score: {analysis['risk_score']}/100 (ID: {risk_log.id})")

        return RiskAnalysisResponse(
            risk_log_id=risk_log.id,
            risk_score=analysis["risk_score"],
            risk_level=analysis["risk_level"],
            ai_summary=ai_summary,
            factors=[RiskFactor(**f) for f in analysis["factors"]],
            recommendations=[RiskRecommendation(**r) for r in analysis["recommendations"]],
            contract_info=analysis["contract_info"],
            is_contract=analysis["is_contract"],
            value_usd=analysis["value_usd"]
        )

    except Exception as e:
        logger.error(f"❌ Risk analysis error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Risk analysis failed: {str(e)}"
        )


@router.post("/risk-decision")
async def record_risk_decision(
    request: RiskDecisionRequest,
    db: Session = Depends(get_db)
):
    """Record user decision (approved/blocked) and update risk log"""
    try:
        logger.info(f"📝 Recording risk decision for log ID {request.risk_log_id}")

        risk_log = db.query(RiskLog).filter(RiskLog.id == request.risk_log_id).first()
        if not risk_log:
            raise HTTPException(status_code=404, detail="Risk log not found")

        risk_log.decision = Decision.approved if request.approved else Decision.blocked
        if request.approved and request.tx_hash:
            risk_log.tx_hash = request.tx_hash

        try:
            db.commit()
            logger.info(f"💾 Risk decision commit successful")
        except Exception as commit_error:
            logger.error(f"❌ Risk decision commit failed: {commit_error}")
            db.rollback()
            raise

        decision_str = "approved" if request.approved else "blocked"
        logger.info(f"✅ Risk decision recorded: {decision_str}")

        return {
            "success": True,
            "risk_log_id": risk_log.id,
            "decision": decision_str
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Risk decision error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to record decision: {str(e)}"
        )