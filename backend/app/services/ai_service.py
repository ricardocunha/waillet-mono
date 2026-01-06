from openai import OpenAI
from typing import List, Dict, Any, Optional
from ..config import settings
import json


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


