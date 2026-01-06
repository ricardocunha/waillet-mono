#!/usr/bin/env python3
"""
Test the AI Intent Parser endpoint
Requires OpenAI API key in .env
"""

import requests
import json

BASE_URL = "http://localhost:8000"


def test_ai_parse_intent():
    """Test parsing natural language into transaction"""
    print("Testing AI Intent Parser...")
    print("=" * 50)
    
    # First, create a test favorite
    print("\n1. Creating test favorite 'binance'...")
    favorite = {
        "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "alias": "binance",
        "address": "0x28C6c06298d514Db089934071355E5743bf21d60",
        "chain": "bsc",
        "asset": "BNB",
        "type": "address"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/favorites", json=favorite)
        if response.status_code in [201, 400]:  # 400 if already exists
            print("✅ Favorite created (or already exists)")
        else:
            print(f"❌ Failed to create favorite: {response.status_code}")
    except Exception as e:
        print(f"⚠️  Could not create favorite: {e}")
    
    # Test AI parsing
    print("\n2. Testing AI Intent Parser...")
    test_cases = [
        "send 50 USDC to binance",
        "transfer 0.1 ETH to 0x123...456",
        "send 100 USDC to vitalik",
    ]
    
    for prompt in test_cases:
        print(f"\n  Prompt: '{prompt}'")
        try:
            response = requests.post(
                f"{BASE_URL}/api/ai/parse-intent",
                json={
                    "prompt": prompt,
                    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"  ✅ Action: {result['action']}")
                if result['action'] == 'transfer':
                    print(f"     To: {result.get('to', 'N/A')}")
                    print(f"     Amount: {result.get('value', 'N/A')} {result.get('token', 'N/A')}")
                    print(f"     Chain: {result.get('chain', 'N/A')}")
                    if result.get('resolved_from'):
                        print(f"     Resolved from: {result['resolved_from']}")
                    print(f"     Confidence: {result.get('confidence', 0)}%")
                elif result.get('error'):
                    print(f"     Error: {result['error']}")
            else:
                print(f"  ❌ Error: {response.status_code}")
                print(f"     {response.text}")
                
        except Exception as e:
            print(f"  ❌ Failed: {e}")
    
    print("\n" + "=" * 50)
    print("Test complete!")


if __name__ == "__main__":
    print("Waillet AI Intent Parser Test")
    print("Make sure:")
    print("  1. Backend is running (uvicorn)")
    print("  2. OPENAI_API_KEY is set in .env")
    print("  3. MySQL is running (docker compose)")
    print()
    
    try:
        # Check if backend is running
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Backend is running\n")
            test_ai_parse_intent()
        else:
            print("❌ Backend not healthy")
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend at localhost:8000")
        print("   Run: uv run uvicorn app.main:app --reload")


