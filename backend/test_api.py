#!/usr/bin/env python3
"""
Simple test script to verify Waillet Backend API is working
Run with: uv run python test_api.py
"""

import requests
import json

BASE_URL = "http://localhost:8000"
TEST_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"


def test_health():
    """Test health check endpoint"""
    print("Testing health check...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}\n")
    return response.status_code == 200


def test_get_favorites():
    """Test getting favorites"""
    print(f"Getting favorites for {TEST_WALLET}...")
    response = requests.get(f"{BASE_URL}/api/favorites/{TEST_WALLET}")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}\n")
    return response.status_code == 200


def test_create_favorite():
    """Test creating a favorite"""
    print("Creating new favorite...")
    favorite = {
        "wallet_address": TEST_WALLET,
        "alias": "test-favorite",
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "chain": "ethereum",
        "asset": "ETH",
        "type": "address"
    }
    response = requests.post(f"{BASE_URL}/api/favorites", json=favorite)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}\n")
    
    if response.status_code == 201:
        return response.json()["id"]
    return None


def test_delete_favorite(favorite_id):
    """Test deleting a favorite"""
    print(f"Deleting favorite {favorite_id}...")
    response = requests.delete(f"{BASE_URL}/api/favorites/{favorite_id}")
    print(f"Status: {response.status_code}\n")
    return response.status_code == 204


def main():
    print("=" * 50)
    print("Waillet Backend API Test")
    print("=" * 50 + "\n")
    
    try:
        # Test 1: Health check
        if not test_health():
            print("❌ Health check failed!")
            return
        print("✅ Health check passed\n")
        
        # Test 2: Get favorites
        if not test_get_favorites():
            print("❌ Get favorites failed!")
            return
        print("✅ Get favorites passed\n")
        
        # Test 3: Create favorite
        favorite_id = test_create_favorite()
        if not favorite_id:
            print("❌ Create favorite failed!")
            return
        print(f"✅ Create favorite passed (ID: {favorite_id})\n")
        
        # Test 4: Delete favorite
        if not test_delete_favorite(favorite_id):
            print("❌ Delete favorite failed!")
            return
        print("✅ Delete favorite passed\n")
        
        print("=" * 50)
        print("🎉 All tests passed!")
        print("=" * 50)
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server!")
        print("Make sure the server is running: uv run uvicorn app.main:app --reload")
    except Exception as e:
        print(f"❌ Test failed with error: {e}")


if __name__ == "__main__":
    main()


