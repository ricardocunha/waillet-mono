"""
Automated tests for Risk Analysis endpoints (Test 15 from checklist.md)
"""
import pytest
import httpx
import asyncio


BASE_URL = "http://localhost:8000"


@pytest.mark.asyncio
async def test_risk_analysis_endpoint_structure():
    """Test 15.1: Risk Analysis Endpoint - Verify response structure"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/api/simulate/risk-analysis",
            json={
                "wallet_address": "0x0d240cD39BdfeB164672a7Af14731F92372B65AC",
                "to_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                "value": "0x0",
                "data": "0x",
                "chain": "sepolia"
            },
            timeout=10.0
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Check required fields exist
        assert "risk_log_id" in data
        assert "risk_score" in data
        assert "risk_level" in data
        assert "ai_summary" in data
        assert "factors" in data
        assert "recommendations" in data
        assert "contract_info" in data
        assert "value_usd" in data

        # Check types
        assert isinstance(data["risk_log_id"], int)
        assert isinstance(data["risk_score"], int)
        assert 0 <= data["risk_score"] <= 100
        assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
        assert isinstance(data["ai_summary"], str)
        assert len(data["ai_summary"]) > 0
        assert isinstance(data["factors"], list)
        assert isinstance(data["recommendations"], list)
        assert isinstance(data["contract_info"], dict)
        assert isinstance(data["value_usd"], (int, float))

        print(f"✅ Risk analysis returned: Score={data['risk_score']}, Level={data['risk_level']}")


@pytest.mark.asyncio
async def test_risk_analysis_low_risk_scenario():
    """Test simple wallet-to-wallet transfer (LOW risk)"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/api/simulate/risk-analysis",
            json={
                "wallet_address": "0x0d240cD39BdfeB164672a7Af14731F92372B65AC",
                "to_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                "value": "0x0",  # 0 ETH
                "data": "0x",    # No contract call
                "chain": "sepolia"
            },
            timeout=10.0
        )

        assert response.status_code == 200
        data = response.json()

        # Simple transfer should be LOW risk
        assert data["risk_level"] == "LOW"
        assert data["risk_score"] <= 30
        assert any(f["type"] == "EOA_TRANSFER" for f in data["factors"])

        print(f"✅ LOW risk scenario: Score={data['risk_score']}")


@pytest.mark.asyncio
async def test_risk_decision_endpoint():
    """Test 15.2: Risk Decision Endpoint"""
    # First create a risk log
    async with httpx.AsyncClient() as client:
        analysis_response = await client.post(
            f"{BASE_URL}/api/simulate/risk-analysis",
            json={
                "wallet_address": "0x0d240cD39BdfeB164672a7Af14731F92372B65AC",
                "to_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                "value": "0x0",
                "data": "0x",
                "chain": "sepolia"
            },
            timeout=10.0
        )

        assert analysis_response.status_code == 200
        risk_log_id = analysis_response.json()["risk_log_id"]

        # Now record decision
        decision_response = await client.post(
            f"{BASE_URL}/api/simulate/risk-decision",
            json={
                "risk_log_id": risk_log_id,
                "approved": True,
                "tx_hash": "0x1234567890abcdef" * 4  # 64 char hex
            },
            timeout=5.0
        )

        assert decision_response.status_code == 200
        decision_data = decision_response.json()

        assert decision_data["success"] is True
        assert decision_data["risk_log_id"] == risk_log_id
        assert decision_data["decision"] == "approved"

        print(f"✅ Decision recorded for risk_log_id={risk_log_id}")


@pytest.mark.asyncio
async def test_risk_analysis_performance():
    """Test that risk analysis completes within 3 seconds"""
    import time

    async with httpx.AsyncClient() as client:
        start_time = time.time()

        response = await client.post(
            f"{BASE_URL}/api/simulate/risk-analysis",
            json={
                "wallet_address": "0x0d240cD39BdfeB164672a7Af14731F92372B65AC",
                "to_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                "value": "0x0",
                "data": "0x",
                "chain": "sepolia"
            },
            timeout=10.0
        )

        elapsed_time = time.time() - start_time

        assert response.status_code == 200
        assert elapsed_time < 3.0, f"Risk analysis took {elapsed_time:.2f}s (should be <3s)"

        print(f"✅ Risk analysis completed in {elapsed_time:.2f}s")


@pytest.mark.asyncio
async def test_external_api_connectivity():
    """Test 15.3: External API Connectivity"""
    async with httpx.AsyncClient(timeout=5.0) as client:
        # CoinGecko
        try:
            response = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "ethereum", "vs_currencies": "usd"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "ethereum" in data
            assert "usd" in data["ethereum"]
            print(f"✅ CoinGecko: ETH price = ${data['ethereum']['usd']}")
        except Exception as e:
            pytest.skip(f"CoinGecko API unavailable: {e}")

        # ChainAbuse (expect 302 or 404)
        try:
            response = await client.get(
                "https://www.chainabuse.com/api/v1/check",
                params={
                    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                    "chain": "ethereum"
                },
                follow_redirects=False
            )
            # 302 redirect is normal
            assert response.status_code in [200, 302, 404]
            print(f"✅ ChainAbuse: Status {response.status_code} (302 is normal)")
        except Exception as e:
            pytest.skip(f"ChainAbuse API unavailable: {e}")


if __name__ == "__main__":
    # Run tests directly
    print("Running backend API tests...\n")
    asyncio.run(test_risk_analysis_endpoint_structure())
    asyncio.run(test_risk_analysis_low_risk_scenario())
    asyncio.run(test_risk_decision_endpoint())
    asyncio.run(test_risk_analysis_performance())
    asyncio.run(test_external_api_connectivity())
    print("\n✅ All backend tests passed!")
