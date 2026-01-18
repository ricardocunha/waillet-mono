"""
Risk analysis for transactions - scores 0-100 based on multiple checks
Looks for: scams, unlimited approvals, delegatecall, large amounts, etc.
"""

import httpx
import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models import RiskLog
from ..routers.rpc import get_rpc_url
from .scam_database import ScamDatabase

logger = logging.getLogger(__name__)

# Cache for API calls
_contract_cache: Dict[str, Dict] = {}
_price_cache: Dict[str, Dict] = {}


class RiskLevel:
    LOW = "LOW"       # 0-30
    MEDIUM = "MEDIUM" # 31-70
    HIGH = "HIGH"     # 71-100


class RiskService:
    def __init__(self, chain: str, db: Session):
        self.chain = chain
        self.db = db
        self.rpc_url = get_rpc_url(chain)
        self.scam_db = ScamDatabase()
        self.timeout = 2.0

    async def analyze_transaction(
        self,
        from_address: str,
        to_address: str,
        value: str,
        data: str = "0x",
        wallet_address: str = None
    ) -> Dict[str, Any]:
        """
        Analyze transaction and return risk score + factors
        Returns dict with: risk_score, risk_level, factors, recommendations, contract_info
        """
        logger.info(f"🔍 Analyzing transaction risk on {self.chain}")
        logger.debug(f"   From: {from_address[:10]}...")
        logger.debug(f"   To: {to_address[:10]}...")
        logger.debug(f"   Data length: {len(data)}")

        risk_score = 0
        factors = []
        recommendations = []

        try:
            # Run async checks in parallel
            async_results = await asyncio.gather(
                self._check_scam_address(to_address),
                self._check_contract(to_address),
                self._check_value_risk(value),
                self._check_interaction_history(wallet_address or from_address, to_address),
                return_exceptions=True
            )

            # Run sync checks
            unlimited_approval = self._check_unlimited_approval(data)
            has_delegatecall = self._check_delegatecall(data)

            # Unpack results
            scam_check = async_results[0] if not isinstance(async_results[0], Exception) else (False, None)
            contract_info = async_results[1] if not isinstance(async_results[1], Exception) else {"is_contract": False}
            value_risk = async_results[2] if not isinstance(async_results[2], Exception) else (0, None, 0)
            first_interaction = async_results[3] if not isinstance(async_results[3], Exception) else False

            # Score each risk factor (highest risk first)

            # Known scam (auto-block)
            is_scam, scam_info = scam_check
            if is_scam:
                risk_score += 50  # AUTO-BLOCK threshold
                factors.append({
                    "type": "SCAM_ADDRESS",
                    "severity": "CRITICAL",
                    "title": "Scam Detected",
                    "description": f"Reported for {scam_info.get('reason', 'fraud')}. Do not send.",
                    "points": 50
                })
                recommendations.append({
                    "icon": "🚫",
                    "text": "Block this transaction",
                    "action": "block"
                })

            # Unlimited ERC-20 approval
            is_unlimited, token_info = unlimited_approval
            if is_unlimited:
                risk_score += 40
                factors.append({
                    "type": "UNLIMITED_APPROVAL",
                    "severity": "HIGH",
                    "title": "Unlimited Approval",
                    "description": "Grants full access to your tokens. Consider limiting the amount.",
                    "points": 40
                })
                recommendations.append({
                    "icon": "⚙️",
                    "text": "Set a specific limit instead",
                    "action": "limit_approval"
                })

            # DelegateCall (can hijack wallet)
            if has_delegatecall:
                risk_score += 40
                factors.append({
                    "type": "DELEGATECALL",
                    "severity": "HIGH",
                    "title": "Advanced Call",
                    "description": "Uses delegatecall - can execute code in your wallet context.",
                    "points": 40
                })
                recommendations.append({
                    "icon": "🛡️",
                    "text": "Only proceed if you trust this contract",
                    "action": "verify_source"
                })

            # Large value
            value_points, value_desc, value_usd = value_risk
            if value_points > 0:
                risk_score += value_points
                factors.append({
                    "type": "LARGE_VALUE",
                    "severity": "MEDIUM",
                    "title": "Large Amount",
                    "description": value_desc,
                    "points": value_points
                })
                recommendations.append({
                    "icon": "🔍",
                    "text": "Double-check the recipient",
                    "action": "verify_recipient"
                })

            # Unverified contract - always MEDIUM
            if contract_info.get("is_contract") and not contract_info.get("verified"):
                risk_score += 35  # Ensure at least MEDIUM (31+)
                verification_reason = contract_info.get("verification_error", "Source code not published")
                factors.append({
                    "type": "UNVERIFIED_CONTRACT",
                    "severity": "MEDIUM",
                    "title": "Unverified Contract",
                    "description": f"Could not verify this contract. {verification_reason}.",
                    "points": 35
                })
                recommendations.append({
                    "icon": "📄",
                    "text": "Check contract on block explorer first",
                    "action": "verify_contract"
                })

            # First time interacting with this contract
            if first_interaction and contract_info.get("is_contract"):
                risk_score += 10
                factors.append({
                    "type": "FIRST_INTERACTION",
                    "severity": "LOW",
                    "title": "New Contract",
                    "description": "First time interacting with this address.",
                    "points": 10
                })
                recommendations.append({
                    "icon": "🕵️",
                    "text": "Research before first use",
                    "action": "research"
                })

            # Simple wallet-to-wallet transfer
            if not contract_info.get("is_contract") and data == "0x":
                risk_score += 5
                factors.append({
                    "type": "EOA_TRANSFER",
                    "severity": "LOW",
                    "title": "Simple Transfer",
                    "description": "Direct wallet-to-wallet transfer.",
                    "points": 5
                })

            risk_score = min(risk_score, 100)

            # Calculate risk level
            if risk_score <= 30:
                risk_level = RiskLevel.LOW
            elif risk_score <= 70:
                risk_level = RiskLevel.MEDIUM
            else:
                risk_level = RiskLevel.HIGH

            if not recommendations:
                recommendations.append({
                    "icon": "✓",
                    "text": "Transaction appears safe to proceed",
                    "action": "proceed"
                })

            result = {
                "risk_score": risk_score,
                "risk_level": risk_level,
                "factors": factors,
                "recommendations": recommendations,
                "contract_info": contract_info,
                "is_contract": contract_info.get("is_contract", False),
                "value_usd": value_usd
            }

            logger.info(f"✅ Risk analysis complete - Score: {risk_score}/100 ({risk_level})")
            return result

        except Exception as e:
            import traceback
            logger.error(f"❌ Risk analysis error: {e}")
            logger.error(f"❌ Full traceback: {traceback.format_exc()}")
            # Return default MEDIUM risk on error
            return {
                "risk_score": 50,
                "risk_level": RiskLevel.MEDIUM,
                "factors": [{
                    "type": "ANALYSIS_ERROR",
                    "severity": "MEDIUM",
                    "title": "⚠️ Analysis Incomplete",
                    "description": f"Risk analysis failed: {str(e)[:100]}. Proceed with caution.",
                    "points": 50
                }],
                "recommendations": [{
                    "icon": "⚠️",
                    "text": "Risk analysis incomplete - be extra careful",
                    "action": "caution"
                }],
                "contract_info": {"is_contract": False},
                "is_contract": False,
                "value_usd": 0,
                "error": str(e)
            }

    async def _check_scam_address(self, address: str) -> Tuple[bool, Optional[Dict]]:
        try:
            return await self.scam_db.is_scam(address, self.chain)
        except Exception as e:
            logger.warning(f"Scam check failed: {e}")
            return False, None

    async def _check_contract(self, address: str) -> Dict[str, Any]:
        """Check if address is a contract and if it's verified"""
        try:
            # Check cache first (24h expiry)
            cache_key = f"{self.chain}:{address.lower()}"
            if cache_key in _contract_cache:
                cached = _contract_cache[cache_key]
                if datetime.now() - cached.get("timestamp", datetime.min) < timedelta(hours=24):
                    return cached

            # Check via eth_getCode
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.rpc_url,
                    json={
                        "jsonrpc": "2.0",
                        "method": "eth_getCode",
                        "params": [address, "latest"],
                        "id": 1
                    }
                )
                data = response.json()
                code = data.get("result", "0x")
                is_contract = code != "0x" and code != "0x0"

            result = {
                "is_contract": is_contract,
                "verified": False,
                "name": None,
                "verification_error": None,
                "timestamp": datetime.now()
            }

            # Check verification if it's a contract
            if is_contract:
                try:
                    verification = await self._check_contract_verification(address)
                    result.update(verification)
                except Exception as e:
                    logger.debug(f"Verification check failed: {e}")
                    result["verification_error"] = "Verification service unavailable"

            # Save to cache
            _contract_cache[cache_key] = result
            return result

        except Exception as e:
            logger.warning(f"Contract check failed: {e}")
            return {
                "is_contract": False,
                "verified": False,
                "name": None,
                "verification_error": f"Could not check contract: {str(e)[:50]}"
            }

    async def _check_contract_verification(self, address: str) -> Dict[str, Any]:
        """Check if contract is verified on Etherscan"""
        # TODO: Add Etherscan API integration
        # For now, return unverified
        return {"verified": False, "name": None}

    def _check_unlimited_approval(self, data: str) -> Tuple[bool, Optional[Dict]]:
        """
        Check if tx is unlimited ERC-20 approval
        approve() = 0x095ea7b3, max uint256 = all F's
        """
        if not data or data == "0x":
            return False, None

        try:
            # Check for approve() signature
            if data[:10].lower() == "0x095ea7b3":
                # Get amount from calldata
                if len(data) >= 74:
                    amount_hex = data[10:74]
                    # Check if it's max uint256 (all F's)
                    if amount_hex.lower().count('f') >= 60:  # Almost all F's
                        return True, {"symbol": "tokens", "method": "approve"}

            return False, None

        except Exception as e:
            logger.debug(f"Approval check error: {e}")
            return False, None

    def _check_delegatecall(self, data: str) -> bool:
        """Check if tx contains delegatecall (simplified check for 0xf4)"""
        if not data or data == "0x":
            return False

        try:
            # Look for 0xf4 in calldata (heuristic check)
            return "f4" in data.lower()
        except Exception as e:
            logger.debug(f"Delegatecall check error: {e}")
            return False

    async def _check_value_risk(self, value: str) -> Tuple[int, Optional[str], float]:
        """Check if transfer value is large. Returns (points, description, usd_value)"""
        try:
            value_int = int(value, 16) if value and value != "0x" and value != "0x0" else 0
            if value_int == 0:
                return 0, None, 0.0

            value_eth = value_int / 1e18

            # Convert to USD
            eth_price = await self._get_eth_price_usd()
            value_usd = value_eth * eth_price

            # Score by amount
            if value_usd >= 10000:  # $10k+
                return 25, f"High value: ${value_usd:,.2f}", value_usd
            elif value_usd >= 1000:  # $1k+
                return 20, f"Large transfer: ${value_usd:,.2f}", value_usd
            elif value_usd >= 100:  # $100+
                return 10, f"Moderate amount: ${value_usd:,.2f}", value_usd
            else:
                return 5, f"Small amount: ${value_usd:,.2f}", value_usd

        except Exception as e:
            logger.debug(f"Value risk check error: {e}")
            return 0, None, 0.0

    async def _get_eth_price_usd(self) -> float:
        """Get ETH price from CoinGecko (5min cache)"""
        try:
            cache_key = "eth_usd"
            if cache_key in _price_cache:
                cached = _price_cache[cache_key]
                if datetime.now() - cached.get("timestamp", datetime.min) < timedelta(minutes=5):
                    return cached["price"]

            # Fetch from CoinGecko
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": "ethereum", "vs_currencies": "usd"}
                )
                data = response.json()
                price = data["ethereum"]["usd"]

                _price_cache[cache_key] = {
                    "price": price,
                    "timestamp": datetime.now()
                }

                return price

        except Exception as e:
            logger.warning(f"Price fetch failed, using fallback: {e}")
            return 2000.0

    async def _check_interaction_history(self, wallet_address: str, contract_address: str) -> bool:
        """Check if wallet interacted with this contract before. Returns True if first time."""
        try:
            # Check database for previous interactions
            previous = self.db.query(RiskLog).filter(
                RiskLog.wallet_address == wallet_address.lower(),
                RiskLog.params.like(f'%{contract_address.lower()}%')
            ).first()

            return previous is None

        except Exception as e:
            logger.debug(f"History check error: {e}")
            return False  # Safer to assume not first time
