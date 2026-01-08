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
            f"- {fav['alias']}: {fav['address']} on {fav['chain']}" +
            (f" ({fav['asset']})" if fav.get('asset') else "")
            for fav in favorites
        ]) if favorites else "No saved favorites yet."
        
        system_prompt = f"""You are a crypto wallet AI assistant. Parse user commands into structured transaction data.

User's wallet: {wallet_address}

Saved favorites (shortcuts):
{favorites_context}

Parse the user's command and return ONLY a JSON object (no markdown, no explanation) with these fields:
{{
    "action": "transfer" | "swap" | "approve" | "unknown",
    "to": recipient address - use ONE of these:
        - If favorite mentioned: use exact address from favorites list above
        - If ENS name (*.eth): preserve it exactly as given (e.g., "vitalik.eth")
        - If 0x address: use it exactly as given
        - If unknown recipient: set action="unknown" and explain in error
    "value": amount as string,
    "token": token symbol (e.g., "USDC", "ETH"),
    "chain": blockchain name (e.g., "ethereum", "polygon", "bsc"),
    "resolved_from": favorite alias if used (or null),
    "confidence": 0-100 (how confident you are),
    "error": error message if command is unclear (or null)
}}

IMPORTANT:
- If a favorite is mentioned, use its exact address and chain from the list above
- If an ENS name is mentioned (like "vitalik.eth"), return it EXACTLY as given (don't make up addresses)
- Never invent placeholder addresses like "0xVitalikAddress" - if you don't know the address, return the ENS name or set action="unknown"
- Use common token symbols (USDC, ETH, BNB, MATIC, etc.)"""

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
            system_prompt = """You are a security expert explaining transaction risks to non-technical users.
Convert technical risk analysis into clear, simple language (2-3 sentences max).

Guidelines:
- Use analogies when helpful (e.g., "like giving someone a blank check")
- Focus on what could go wrong, not technical details
- Be direct but not alarmist
- End with actionable advice when appropriate

Examples:
- "This transaction requests unlimited access to your USDC tokens. It's like giving someone a blank check to your bank account - they could withdraw everything at any time. Consider using a limited approval instead."
- "This is a simple wallet-to-wallet transfer with no smart contract interaction. It's as safe as handing someone cash in person."
- "This contract hasn't been verified on Etherscan, so we can't confirm what it does. It's like entering a building with no signs - you can't be sure what's inside."
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
            logger.info(f"✅ Generated risk explanation ({len(explanation)} chars)")
            return explanation

        except Exception as e:
            logger.error(f"❌ Risk explanation generation failed: {e}")
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

        if risk_score >= 70:
            return f"This transaction has a HIGH risk score ({risk_score}/100). It involves patterns commonly seen in scams or dangerous operations. Proceed only if you fully trust the recipient."
        elif risk_score >= 30:
            return f"This transaction has a MEDIUM risk score ({risk_score}/100). While not necessarily dangerous, it requires your attention. Double-check all details before confirming."
        else:
            return f"This transaction appears relatively safe (risk score: {risk_score}/100). It's a straightforward operation with minimal security concerns."


