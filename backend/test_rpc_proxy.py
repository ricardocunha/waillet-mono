#!/usr/bin/env python3
"""
Test script for RPC Proxy

Tests that the backend RPC proxy is working correctly.
"""
import requests
import sys

BASE_URL = "http://localhost:8000/api/rpc"

def test_health():
    """Test RPC proxy health endpoint"""
    print("🏥 Testing RPC proxy health...")
    response = requests.get(f"{BASE_URL}/health")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Health check passed")
        print(f"   Alchemy configured: {data['alchemy_configured']}")
        print(f"   Infura configured: {data['infura_configured']}")
        print(f"   Supported chains: {data['supported_chains']}")
        return True
    else:
        print(f"❌ Health check failed: {response.status_code}")
        return False

def test_sepolia_block_number():
    """Test getting Sepolia block number"""
    print("\n🔢 Testing Sepolia block number...")
    response = requests.post(
        f"{BASE_URL}/proxy",
        json={
            "chain": "sepolia",
            "method": "eth_blockNumber",
            "params": [],
            "id": 1
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        if 'result' in data:
            block = int(data['result'], 16)
            print(f"✅ Sepolia block number: {block:,}")
            return True
        else:
            print(f"❌ No result in response: {data}")
            return False
    else:
        print(f"❌ Request failed: {response.status_code} - {response.text}")
        return False

def test_balance():
    """Test getting balance for a test address"""
    print("\n💰 Testing balance fetch...")
    # Use a properly checksummed address
    test_address = "0x0000000000000000000000000000000000000000"
    
    response = requests.post(
        f"{BASE_URL}/proxy",
        json={
            "chain": "sepolia",
            "method": "eth_getBalance",
            "params": [test_address, "latest"],
            "id": 1
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        if 'result' in data:
            balance_wei = int(data['result'], 16)
            balance_eth = balance_wei / 1e18
            print(f"✅ Balance for {test_address[:8]}...{test_address[-6:]}")
            print(f"   {balance_eth:.6f} ETH")
            return True
        else:
            print(f"❌ No result in response: {data}")
            return False
    else:
        print(f"❌ Request failed: {response.status_code} - {response.text}")
        return False

def test_base_sepolia():
    """Test Base Sepolia endpoint"""
    print("\n🔷 Testing Base Sepolia block number...")
    response = requests.post(
        f"{BASE_URL}/proxy",
        json={
            "chain": "base-sepolia",
            "method": "eth_blockNumber",
            "params": [],
            "id": 1
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        if 'result' in data:
            block = int(data['result'], 16)
            print(f"✅ Base Sepolia block number: {block:,}")
            return True
        else:
            print(f"❌ No result in response: {data}")
            return False
    else:
        print(f"❌ Request failed: {response.status_code} - {response.text}")
        return False

def main():
    """Run all tests"""
    print("🧪 RPC Proxy Test Suite\n")
    print("="*50)
    
    tests = [
        ("Health Check", test_health),
        ("Sepolia Block Number", test_sepolia_block_number),
        ("Balance Fetch", test_balance),
        ("Base Sepolia Block Number", test_base_sepolia),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name} crashed: {e}")
            results.append((name, False))
    
    print("\n" + "="*50)
    print("\n📊 Test Results:")
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
    
    print(f"\n🎯 {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! RPC proxy is working perfectly!")
        return 0
    else:
        print("\n⚠️ Some tests failed. Check backend logs for details.")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1)

