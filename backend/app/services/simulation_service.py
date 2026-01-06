import httpx
import logging
from typing import Dict, List, Any, Optional
from ..routers.rpc import get_rpc_url

logger = logging.getLogger(__name__)

# ERC-20 Transfer event signature
TRANSFER_EVENT_SIGNATURE = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


class SimulationService:
    """Service for simulating transactions using eth_call and eth_estimateGas"""

    def __init__(self, chain: str):
        self.chain = chain
        self.rpc_url = get_rpc_url(chain)

    async def simulate_transaction(
        self,
        from_address: str,
        to: str,
        value: str,
        data: str = "0x",
        token: Optional[str] = None
    ) -> Dict[str, Any]:

        try:
            # Validate addresses are valid hex
            from_hex = from_address[2:] if from_address.startswith("0x") else from_address
            to_hex = to[2:] if to.startswith("0x") else to

            # Check if addresses contain only valid hex characters
            try:
                int(from_hex, 16)
                int(to_hex, 16)
            except ValueError:
                raise Exception("Invalid address format: addresses must contain only hexadecimal characters")

            # Store original addresses for response
            original_from = from_address.lower() if from_address.startswith("0x") else f"0x{from_address.lower()}"
            original_to = to.lower() if to.startswith("0x") else f"0x{to.lower()}"

            # Pad addresses to 40 characters if needed
            from_hex = from_hex.lower().zfill(40)
            to_hex = to_hex.lower().zfill(40)

            from_address_padded = f"0x{from_hex}"
            to_padded = f"0x{to_hex}"

            # Ensure value is properly formatted with even number of hex digits
            if not value or value == "0x" or value == "0x0":
                value = "0x0"
            else:
                # Remove 0x prefix if present
                hex_value = value[2:] if value.startswith("0x") else value
                # Pad to even length
                if len(hex_value) % 2 != 0:
                    hex_value = "0" + hex_value
                value = f"0x{hex_value}"

            # Build transaction object (use padded addresses for RPC)
            tx_object = {
                "from": from_address_padded,
                "to": to_padded,
                "value": value,
                "data": data if data else "0x"
            }

            # Step 1: Simulate transaction with eth_call (to detect reverts)
            try:
                call_result = await self._eth_call(tx_object)
            except Exception as call_error:
                # If eth_call fails, the transaction would revert
                error_msg = str(call_error)
                revert_reason = self._extract_revert_reason(error_msg)

                return {
                    "success": False,
                    "balance_changes": [],
                    "events": [],
                    "gas_used": 0,
                    "error": error_msg,
                    "revert_reason": revert_reason
                }

            # Step 2: Estimate gas
            gas_estimate = await self._estimate_gas(tx_object)

            # Step 3: Calculate balance changes
            balance_changes = []

            value_int = int(value, 16) if value and value != "0x" and value != "0x0" else 0

            if value_int > 0:
                # Native token transfer (use original addresses in response)
                value_eth = value_int / 1e18
                balance_changes.append({
                    "address": original_from,
                    "token": self._get_native_token(),
                    "change": f"-{value_eth:.6f}"
                })
                balance_changes.append({
                    "address": original_to,
                    "token": self._get_native_token(),
                    "change": f"+{value_eth:.6f}"
                })

            # Step 4: Parse events from logs (if ERC-20 transfer)
            events = []
            if data and data != "0x" and len(data) > 10:
                # Attempt to decode Transfer event (use original addresses)
                events = self._parse_transfer_logs(original_from, original_to, data, token)

            return {
                "success": True,
                "balance_changes": balance_changes,
                "events": events,
                "gas_used": int(gas_estimate, 16),
                "error": None,
                "revert_reason": None
            }

        except Exception as e:
            error_msg = str(e)
            revert_reason = self._extract_revert_reason(error_msg)

            return {
                "success": False,
                "balance_changes": [],
                "events": [],
                "gas_used": 0,
                "error": error_msg,
                "revert_reason": revert_reason
            }

    async def _eth_call(self, tx_object: Dict[str, str]) -> str:
        """Execute eth_call RPC"""
        logger.debug(f"eth_call tx_object: {tx_object}")
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                self.rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "method": "eth_call",
                    "params": [tx_object, "latest"],
                    "id": 1
                },
                headers={"Content-Type": "application/json"}
            )
            result = response.json()
            logger.debug(f"eth_call result: {result}")

            if "error" in result:
                error_data = result["error"]
                error_message = error_data.get("message", str(error_data))
                raise Exception(error_message)

            return result.get("result", "0x")

    async def _estimate_gas(self, tx_object: Dict[str, str]) -> str:
        """Estimate gas usage"""
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                self.rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "method": "eth_estimateGas",
                    "params": [tx_object],
                    "id": 1
                },
                headers={"Content-Type": "application/json"}
            )
            result = response.json()

            if "error" in result:
                error_data = result["error"]
                error_message = error_data.get("message", str(error_data))
                raise Exception(error_message)

            return result.get("result", "0x5208")  # Default 21000 gas

    def _get_native_token(self) -> str:
        """Get native token symbol for chain"""
        native_tokens = {
            "sepolia": "ETH",
            "base-sepolia": "ETH",
            "ethereum": "ETH",
            "polygon": "MATIC",
            "bsc": "BNB",
            "base": "ETH"
        }
        return native_tokens.get(self.chain.lower(), "ETH")

    def _parse_transfer_logs(
        self,
        from_addr: str,
        to_addr: str,
        data: str,
        token: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Parse ERC-20 Transfer events from transaction data"""
        # Check if data contains transfer function signature (0xa9059cbb)
        if data.startswith("0xa9059cbb"):
            # Decode: function signature (4 bytes) + recipient address (32 bytes) + amount (32 bytes)
            if len(data) >= 138:  # 0xa9059cbb (10 chars) + 64 hex chars + 64 hex chars
                try:
                    # Extract recipient address (remove leading zeros)
                    recipient_hex = data[10:74]  # Skip function sig (10 chars), get 64 chars
                    recipient = "0x" + recipient_hex[-40:]  # Take last 40 chars (20 bytes)

                    # Extract amount
                    amount_hex = data[74:138]
                    amount_int = int(amount_hex, 16)

                    # Assume 6 decimals for USDC/USDT, 18 for others
                    decimals = 6 if token and token.upper() in ["USDC", "USDT"] else 18
                    amount_formatted = amount_int / (10 ** decimals)

                    return [{
                        "name": "Transfer",
                        "args": {
                            "from": from_addr,
                            "to": recipient,
                            "value": str(amount_formatted)
                        },
                        "address": to_addr  # Contract address
                    }]
                except Exception as e:
                    logger.warning(f"Failed to parse transfer data: {e}")
                    return []

        return []

    def _extract_revert_reason(self, error_msg: str) -> Optional[str]:
        """Extract revert reason from error message"""
        error_lower = error_msg.lower()

        if "execution reverted" in error_lower:
            # Try to extract custom message
            if ":" in error_msg:
                parts = error_msg.split(":")
                if len(parts) > 1:
                    return parts[-1].strip()
            return "Transaction reverted"

        if "insufficient funds" in error_lower or "insufficient balance" in error_lower:
            return "Insufficient balance for transaction"

        if "gas required exceeds allowance" in error_lower:
            return "Insufficient gas"

        if "invalid address" in error_lower:
            return "Invalid recipient address"

        return None