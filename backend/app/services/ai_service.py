from openai import OpenAI
from typing import List, Dict, Any, Optional
from ..config import settings
import json
import logging

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set in environment")
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def parse_intent(
        self,
        prompt: str,
        wallet_address: str,
        favorites: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        favorites_context = "\n".join([
            f"- {fav['alias']}: {fav['address']}" +
            (f" ({fav['asset']})" if fav.get('asset') else "")
            for fav in favorites
        ]) if favorites else "No saved favorites yet."
        
        system_prompt = f"""You are a crypto wallet AI assistant. Parse user commands into structured transaction data.

User's wallet: {wallet_address}

Saved favorites (shortcuts):
{favorites_context}

Parse the user's command and return ONLY a JSON object (no markdown, no explanation) with these fields:
{{
    "action": "transfer" | "swap" | "approve" | "save_favorite" | "delete_favorite" | "list_favorites" | "unknown",
    "to": recipient address - use ONE of these:
        - If favorite mentioned: use exact address from favorites list above
        - If ENS name (*.eth): preserve it exactly as given (e.g., "vitalik.eth")
        - If email address (user@domain.com): preserve it exactly as given
        - If .waillet alias (name.waillet): preserve it exactly as given
        - If simple alias without suffix: add .waillet (e.g., "ricardo" -> "ricardo.waillet")
        - If 0x address: use it exactly as given
        - If unknown recipient: set action="unknown" and explain in error
        - For save_favorite: the address to save
        - For list_favorites: null
    "value": amount as string (null for save_favorite/list_favorites),
    "token": token symbol (e.g., "USDC", "ETH"),
    "chain": blockchain name if EXPLICITLY specified by user (e.g., "ethereum", "base", "sepolia", "base-sepolia"), or null if not specified,
    "needs_network": true if the user did NOT specify a network and this is a transfer action, false otherwise,
    "resolved_from": favorite alias if used (or null),
    "alias": For save_favorite or delete_favorite - the nickname/alias to save or delete (or null for other actions),
    "confidence": 0-100 (how confident you are),
    "error": error message if command is unclear (or null)
}}

CRITICAL NETWORK RULE:
- For transfer/swap/approve actions: If the user does NOT explicitly mention a network (like "on ethereum", "on sepolia", "on base"), set chain=null and needs_network=true
- NEVER assume or default to any network - always ask the user to choose if not specified
- Only set chain to a value if the user EXPLICITLY mentions it in their command

CRITICAL RECIPIENT RESOLUTION (follow this ORDER - favorites have HIGHEST priority):
1. FIRST: Check if recipient matches a favorite alias (case-insensitive)
   - If YES: use the EXACT 0x address from the favorites list, set "resolved_from" to the alias name
   - Example: favorites has "ricardo: 0x1a129CDc5f5E7a2EDaD31BD390aE306C29eC21E7"
     User says "send to ricardo" -> "to": "0x1a129CDc5f5E7a2EDaD31BD390aE306C29eC21E7", "resolved_from": "ricardo"
2. If NOT a favorite AND is an ENS name (*.eth): use it exactly as given
3. If NOT a favorite AND is an email: use it exactly as given
4. If NOT a favorite AND already has .waillet suffix: use it exactly as given
5. If NOT a favorite AND is a simple name without suffix: add .waillet suffix
6. If it's a 0x address: use it exactly as given

IMPORTANT:
- ALWAYS check the favorites list FIRST before adding .waillet suffix!
- Never invent placeholder addresses - if unknown, return the identifier as-is
- Use common token symbols (USDC, ETH, USDT, etc.)

TRANSFER EXAMPLES (network NOT specified - needs_network=true):
- "send 10 USDC to john@gmail.com" -> {{"action": "transfer", "to": "john@gmail.com", "value": "10", "token": "USDC", "chain": null, "needs_network": true, "confidence": 95}}
- "send 0.1 ETH to ricardo.waillet" -> {{"action": "transfer", "to": "ricardo.waillet", "value": "0.1", "token": "ETH", "chain": null, "needs_network": true, "confidence": 95}}
- "transfer 5 USDC to maria" -> {{"action": "transfer", "to": "maria.waillet", "value": "5", "token": "USDC", "chain": null, "needs_network": true, "confidence": 90}}
- "send 1 ETH to binance" -> {{"action": "transfer", "to": "0x...", "value": "1", "token": "ETH", "chain": null, "needs_network": true, "resolved_from": "binance", "confidence": 95}}

TRANSFER EXAMPLES (network EXPLICITLY specified - needs_network=false):
- "send 1 ETH to binance on ethereum" -> {{"action": "transfer", "to": "0x...", "value": "1", "token": "ETH", "chain": "ethereum", "needs_network": false, "resolved_from": "binance", "confidence": 95}}
- "send 10 USDC to john@gmail.com on base-sepolia" -> {{"action": "transfer", "to": "john@gmail.com", "value": "10", "token": "USDC", "chain": "base-sepolia", "needs_network": false, "confidence": 95}}
- "transfer 5 ETH on sepolia to 0x123..." -> {{"action": "transfer", "to": "0x123...", "value": "5", "token": "ETH", "chain": "sepolia", "needs_network": false, "confidence": 95}}

SAVE FAVORITE EXAMPLES (no network needed):
- "save favorite johndoe 0x123..." -> {{"action": "save_favorite", "alias": "johndoe", "to": "0x123...", "needs_network": false, "confidence": 95}}
- "save 0x123... as binance" -> {{"action": "save_favorite", "alias": "binance", "to": "0x123...", "needs_network": false, "confidence": 95}}
- "add favorite alice.eth" -> {{"action": "save_favorite", "alias": "alice", "to": "alice.eth", "needs_network": false, "confidence": 95}}

LIST FAVORITES EXAMPLES:
- "show my favorites" -> {{"action": "list_favorites", "confidence": 100}}
- "list favorites" -> {{"action": "list_favorites", "confidence": 100}}
- "what are my saved addresses" -> {{"action": "list_favorites", "confidence": 95}}
- "my contacts" -> {{"action": "list_favorites", "confidence": 90}}
- "show saved" -> {{"action": "list_favorites", "confidence": 85}}

DELETE FAVORITE EXAMPLES:
- "delete ricardo1 from favorites" -> {{"action": "delete_favorite", "alias": "ricardo1", "confidence": 95}}
- "remove binance from my favorites" -> {{"action": "delete_favorite", "alias": "binance", "confidence": 95}}
- "delete favorite alice" -> {{"action": "delete_favorite", "alias": "alice", "confidence": 90}}
- "remove contact john" -> {{"action": "delete_favorite", "alias": "john", "confidence": 85}}"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=300
            )

            result = response.choices[0].message.content.strip()

            if result.startswith("```"):
                result = result.split("```")[1]
                if result.startswith("json"):
                    result = result[4:]
                result = result.strip()
            
            parsed = json.loads(result)
            return parsed
            
        except json.JSONDecodeError as e:
            return {
                "action": "unknown",
                "error": f"Failed to parse AI response: {str(e)}",
                "confidence": 0
            }
        except Exception as e:
            return {
                "action": "unknown",
                "error": f"AI service error: {str(e)}",
                "confidence": 0
            }

    def generate_risk_explanation(
        self,
        risk_analysis: Dict[str, Any],
        to_address: str,
        value_usd: float
    ) -> str:
        """
        Generate plain-English risk explanation from technical analysis

        Args:
            risk_analysis: Output from RiskService.analyze_transaction()
            to_address: Transaction recipient
            value_usd: Value in USD

        Returns:
            2-3 sentence human-readable explanation
        """
        try:
            risk_score = risk_analysis.get("risk_score", 0)
            risk_level = risk_analysis.get("risk_level", "MEDIUM")
            factors = risk_analysis.get("factors", [])
            is_contract = risk_analysis.get("is_contract", False)

            # Build context from risk factors
            factor_descriptions = []
            for factor in factors:
                factor_descriptions.append(f"- {factor.get('title', '')}: {factor.get('description', '')}")

            factors_text = "\n".join(factor_descriptions) if factor_descriptions else "No specific risk factors detected"

            # Prepare prompt
            system_prompt = """You are a security expert. Explain transaction risks in 1-2 SHORT sentences.

Rules:
- Be concise and direct
- No technical jargon
- State the risk clearly
- Give one actionable tip if helpful

Examples:
- "Simple wallet transfer. Safe to proceed."
- "Unlimited token approval requested. Consider setting a specific limit."
- "Unverified contract - source code not public. Verify on block explorer first."
- "Large transfer amount. Double-check the recipient address."
- "Known scam address. Do not proceed."
"""

            user_prompt = f"""Transaction Details:
- Recipient: {to_address[:10]}...
- Value: ${value_usd:,.2f} USD
- Risk Score: {risk_score}/100 ({risk_level})
- Contract Interaction: {'Yes' if is_contract else 'No'}

Risk Factors:
{factors_text}

Explain this transaction's risks in 2-3 simple sentences."""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.5,
                max_tokens=150
            )

            explanation = response.choices[0].message.content.strip()
            logger.info(f"Generated risk explanation ({len(explanation)} chars)")
            return explanation

        except Exception as e:
            logger.error(f"Risk explanation generation failed: {e}")
            # Fallback to template-based explanation
            return self._fallback_risk_explanation(risk_analysis, to_address, value_usd)

    def _fallback_risk_explanation(
        self,
        risk_analysis: Dict[str, Any],
        to_address: str,
        value_usd: float
    ) -> str:
        """Template-based fallback when AI explanation fails"""
        risk_score = risk_analysis.get("risk_score", 0)
        risk_level = risk_analysis.get("risk_level", "MEDIUM")
        factors = risk_analysis.get("factors", [])

        # Get the main risk factor description if available
        main_factor = factors[0].get("description", "") if factors else ""

        if risk_score >= 70:
            return f"High risk ({risk_score}/100). {main_factor or 'Potential security issue detected.'} Only proceed if you trust this recipient."
        elif risk_score >= 30:
            return f"Medium risk ({risk_score}/100). {main_factor or 'Could not fully verify this transaction.'} Review details before confirming."
        else:
            return f"Low risk ({risk_score}/100). {main_factor or 'Standard transaction.'} Safe to proceed."
