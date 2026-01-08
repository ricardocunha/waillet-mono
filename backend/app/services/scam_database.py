"""
Check if addresses are known scams using ChainAbuse API + local blacklist
"""

import httpx
import logging
from typing import Tuple, Optional, Dict, Set
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Cache for scam checks
_scam_cache: Dict[str, Dict] = {}

# Local blacklist
LOCAL_BLACKLIST: Set[str] = {
    "0x0000000000000000000000000000000000000000",
}

class ScamDatabase:
    def __init__(self):
        self.timeout = 2.0  # timeout for API calls

    async def is_scam(self, address: str, chain: str = "ethereum") -> Tuple[bool, Optional[Dict]]:
        """
        Check if address is a known scam
        Returns (is_scam, scam_info) where scam_info has reason/source/reports
        """
        try:
            address_lower = address.lower()

            # Check cache first (24h expiry)
            if address_lower in _scam_cache:
                cached = _scam_cache[address_lower]
                if datetime.now() - cached.get("timestamp", datetime.min) < timedelta(hours=24):
                    logger.debug(f"Scam check (cached): {address[:10]}... = {cached['is_scam']}")
                    return cached["is_scam"], cached.get("info")

            # Check local blacklist first
            if address_lower in LOCAL_BLACKLIST:
                result = {
                    "is_scam": True,
                    "info": {
                        "reason": "Manually blacklisted address",
                        "source": "local",
                        "reports": 1
                    },
                    "timestamp": datetime.now()
                }
                _scam_cache[address_lower] = result
                logger.warning(f"⛔ Scam detected (local blacklist): {address[:10]}...")
                return True, result["info"]

            # Check ChainAbuse API
            chainabuse_result = await self._check_chainabuse(address, chain)
            if chainabuse_result[0]:
                result = {
                    "is_scam": True,
                    "info": chainabuse_result[1],
                    "timestamp": datetime.now()
                }
                _scam_cache[address_lower] = result
                logger.warning(f"⛔ Scam detected (ChainAbuse): {address[:10]}...")
                return True, result["info"]

            # Not a scam (cache negative result too)
            result = {
                "is_scam": False,
                "info": None,
                "timestamp": datetime.now()
            }
            _scam_cache[address_lower] = result
            logger.debug(f"✅ Address clean: {address[:10]}...")
            return False, None

        except Exception as e:
            logger.error(f"Scam check error: {e}")
            # On error, return False (don't block legit transactions)
            return False, None

    async def _check_chainabuse(self, address: str, chain: str) -> Tuple[bool, Optional[Dict]]:
        """Check ChainAbuse.com API (free, no key needed)"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    "https://www.chainabuse.com/api/v1/check",
                    params={
                        "address": address,
                        "chain": self._normalize_chain_name(chain)
                    },
                    headers={
                        "Accept": "application/json"
                    }
                )

                if response.status_code == 200:
                    data = response.json()

                    if data.get("reported", False) or data.get("count", 0) > 0:
                        return True, {
                            "reason": data.get("category", "fraudulent activity"),
                            "source": "ChainAbuse.com",
                            "reports": data.get("count", 1)
                        }

                elif response.status_code == 404:
                    return False, None  # Not in their database

                else:
                    logger.warning(f"ChainAbuse API returned {response.status_code}")
                    return False, None

            return False, None

        except httpx.TimeoutException:
            logger.warning("ChainAbuse API timeout")
            return False, None
        except Exception as e:
            logger.warning(f"ChainAbuse check failed: {e}")
            return False, None

    def _normalize_chain_name(self, chain: str) -> str:
        """Convert our chain names to ChainAbuse format"""
        chain_map = {
            "ethereum": "ethereum",
            "sepolia": "ethereum",
            "mainnet": "ethereum",
            "polygon": "polygon",
            "bsc": "binance-smart-chain",
            "arbitrum": "arbitrum",
            "optimism": "optimism"
        }
        return chain_map.get(chain.lower(), "ethereum")

    def add_to_blacklist(self, address: str, reason: str = "Manual addition"):
        """Add address to local blacklist"""
        address_lower = address.lower()
        LOCAL_BLACKLIST.add(address_lower)

        # Update cache
        _scam_cache[address_lower] = {
            "is_scam": True,
            "info": {
                "reason": reason,
                "source": "local",
                "reports": 1
            },
            "timestamp": datetime.now()
        }

        logger.info(f"Added to blacklist: {address} ({reason})")

    def remove_from_blacklist(self, address: str):
        """Remove address from blacklist"""
        address_lower = address.lower()
        if address_lower in LOCAL_BLACKLIST:
            LOCAL_BLACKLIST.remove(address_lower)
            logger.info(f"Removed from blacklist: {address}")

        # Clear cache
        if address_lower in _scam_cache:
            del _scam_cache[address_lower]
