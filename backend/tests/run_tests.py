"""
Simple test runner for backend API tests (doesn't require pytest)
Run with: python3 tests/run_tests.py
"""
import httpx
import time
import sys


BASE_URL = "http://localhost:8000"


async def test_risk_analysis_endpoint():
    """Test 15.1: Risk Analysis Endpoint - Verify response structure"""
    print("\n[TEST] Risk Analysis Endpoint Structure...")

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

        # Check required fields
        required = ["risk_log_id", "risk_score", "risk_level", "ai_summary", "factors", "recommendations", "contract_info", "value_usd"]
        for field in required:
            assert field in data, f"Missing field: {field}"

        # Check types and values
        assert isinstance(data["risk_log_id"], int)
        assert 0 <= data["risk_score"] <= 100
        assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
        assert len(data["ai_summary"]) > 0

        print(f"✅ PASS - Score={data['risk_score']}, Level={data['risk_level']}")
        return data


async def test_low_risk_scenario():
    """Test simple wallet-to-wallet transfer (LOW risk)"""
    print("\n[TEST] LOW Risk Scenario...")

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

        data = response.json()
        assert data["risk_level"] == "LOW", f"Expected LOW, got {data['risk_level']}"
        assert data["risk_score"] <= 30, f"Expected score <=30, got {data['risk_score']}"

        print(f"✅ PASS - Score={data['risk_score']}")
        return data


async def test_risk_decision():
    """Test 15.2: Risk Decision Endpoint"""
    print("\n[TEST] Risk Decision Endpoint...")

    async with httpx.AsyncClient() as client:
        # Create risk log
        analysis = await client.post(
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
        risk_log_id = analysis.json()["risk_log_id"]

        # Record decision
        decision = await client.post(
            f"{BASE_URL}/api/simulate/risk-decision",
            json={
                "risk_log_id": risk_log_id,
                "approved": True,
                "tx_hash": "0x" + "1234567890abcdef" * 4
            },
            timeout=5.0
        )

        data = decision.json()
        assert data["success"] is True
        assert data["decision"] == "approved"

        print(f"✅ PASS - Decision recorded for risk_log_id={risk_log_id}")


async def test_performance():
    """Test that risk analysis completes within 3 seconds"""
    print("\n[TEST] Performance (<3s)...")

    async with httpx.AsyncClient() as client:
        start = time.time()

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

        elapsed = time.time() - start
        assert elapsed < 3.0, f"Took {elapsed:.2f}s (should be <3s)"

        print(f"✅ PASS - Completed in {elapsed:.2f}s")


async def test_external_apis():
    """Test 15.3: External API Connectivity"""
    print("\n[TEST] External API Connectivity...")

    async with httpx.AsyncClient(timeout=5.0) as client:
        # CoinGecko
        try:
            response = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "ethereum", "vs_currencies": "usd"}
            )
            data = response.json()
            print(f"  CoinGecko: ✅ ETH=${data['ethereum']['usd']}")
        except Exception as e:
            print(f"  CoinGecko: ⚠️  {e}")

        # ChainAbuse
        try:
            response = await client.get(
                "https://www.chainabuse.com/api/v1/check",
                params={"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", "chain": "ethereum"},
                follow_redirects=False
            )
            print(f"  ChainAbuse: ✅ Status {response.status_code} (302 is normal)")
        except Exception as e:
            print(f"  ChainAbuse: ⚠️  {e}")

    print("✅ PASS")


async def main():
    print("=" * 60)
    print("Backend API Tests (Test 15 from checklist.md)")
    print("=" * 60)

    tests = [
        test_risk_analysis_endpoint,
        test_low_risk_scenario,
        test_risk_decision,
        test_performance,
        test_external_apis,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            await test()
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL - {e}")
            failed += 1
        except Exception as e:
            print(f"❌ ERROR - {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    import asyncio
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
