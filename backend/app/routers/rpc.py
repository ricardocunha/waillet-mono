from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
import httpx
import logging
from ..config import settings

router = APIRouter(prefix="/rpc", tags=["rpc"])
logger = logging.getLogger(__name__)

class RPCRequest(BaseModel):
    chain: str
    method: str
    params: list = []
    id: int = 1
    jsonrpc: str = "2.0"

class RPCResponse(BaseModel):
    jsonrpc: str
    id: int
    result: Any = None
    error: Dict[str, Any] = None

def get_rpc_url(chain: str) -> str:
    chain = chain.lower()

    if settings.ALCHEMY_API_KEY:
        if chain == "sepolia":
            return f"https://eth-sepolia.g.alchemy.com/v2/{settings.ALCHEMY_API_KEY}"
        elif chain == "base-sepolia":
            return f"https://base-sepolia.g.alchemy.com/v2/{settings.ALCHEMY_API_KEY}"

    if settings.INFURA_API_KEY:
        if chain == "sepolia":
            return f"https://sepolia.infura.io/v3/{settings.INFURA_API_KEY}"

    fallback_urls = {
        "sepolia": "https://rpc2.sepolia.org",
        "base-sepolia": "https://sepolia.base.org",
    }
    
    url = fallback_urls.get(chain)
    if not url:
        raise HTTPException(status_code=400, detail=f"Unsupported chain: {chain}")
    
    logger.warning(f"⚠️ No API key configured for {chain}. Using public endpoint (unreliable).")
    return url

@router.post("/proxy")
async def proxy_rpc(request: RPCRequest) -> Dict[str, Any]:
    try:
        rpc_url = get_rpc_url(request.chain)

        rpc_payload = {
            "jsonrpc": request.jsonrpc,
            "method": request.method,
            "params": request.params,
            "id": request.id,
        }
        
        logger.info(f"🔄 RPC Proxy: {request.chain} → {request.method}")
        logger.debug(f"📤 Request: {rpc_payload}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                rpc_url,
                json=rpc_payload,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code != 200:
                logger.error(f"❌ RPC Error: HTTP {response.status_code}: {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"RPC provider error: {response.text}"
                )

            result = response.json()
            logger.debug(f"✅ Response: {result}")

            if "error" in result:
                logger.error(f"❌ RPC Error: {result['error']}")
            
            return result
            
    except httpx.TimeoutException:
        logger.error(f"⏱️ RPC Timeout for {request.chain}")
        raise HTTPException(status_code=504, detail="RPC request timeout")
    except httpx.RequestError as e:
        logger.error(f"🔌 RPC Connection Error: {e}")
        raise HTTPException(status_code=503, detail=f"Cannot connect to RPC provider: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Unexpected RPC Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def rpc_health():
    alchemy_configured = bool(settings.ALCHEMY_API_KEY and settings.ALCHEMY_API_KEY != "your_alchemy_api_key_here")
    infura_configured = bool(settings.INFURA_API_KEY and settings.INFURA_API_KEY != "your_infura_key_here")
    
    return {
        "status": "ok",
        "alchemy_configured": alchemy_configured,
        "infura_configured": infura_configured,
        "supported_chains": ["sepolia", "base-sepolia"],
        "recommended": "Add ALCHEMY_API_KEY to backend/.env for best reliability"
    }
