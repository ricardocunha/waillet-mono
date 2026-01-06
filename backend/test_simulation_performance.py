#!/usr/bin/env python3
"""
Performance tests for Transaction Simulation API

Tests that simulations meet the <2s performance requirement.
"""
import requests
import sys
import time
import concurrent.futures

BASE_URL = "http://localhost:8000/api/simulate"


def test_single_simulation_performance():
    """Test that a single simulation completes within 2 seconds"""
    print("⚡ Testing single simulation performance (<2s requirement)...")

    request_data = {
        "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "to": "0x0000000000000000000000000000000000000001",
        "value": "0x16345785d8a0000",  # 0.1 ETH
        "chain": "sepolia"
    }

    start = time.time()
    response = requests.post(f"{BASE_URL}/transaction", json=request_data)
    duration = time.time() - start

    if response.status_code == 200:
        if duration < 2.0:
            print(f"✅ Simulation completed in {duration:.3f}s (< 2s ✓)")
            return True
        else:
            print(f"❌ Simulation took {duration:.3f}s (exceeds 2s requirement)")
            return False
    else:
        print(f"❌ Request failed: {response.status_code}")
        return False


def test_concurrent_simulations():
    """Test that 10 concurrent simulations complete efficiently"""
    print("\n🚀 Testing 10 concurrent simulations...")

    request_data = {
        "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "to": "0x0000000000000000000000000000000000000001",
        "value": "0x16345785d8a0000",
        "chain": "sepolia"
    }

    def make_request():
        return requests.post(f"{BASE_URL}/transaction", json=request_data)

    start = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(make_request) for _ in range(10)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
    duration = time.time() - start

    success_count = sum(1 for r in results if r.status_code == 200)

    if success_count == 10:
        avg_time = duration / 10
        print(f"✅ All 10 simulations succeeded in {duration:.2f}s total ({avg_time:.2f}s avg)")

        if duration < 10.0:
            print(f"   Performance: Good (< 10s for 10 requests)")
            return True
        else:
            print(f"   Performance: Slow (> 10s for 10 requests)")
            return False
    else:
        print(f"❌ Only {success_count}/10 simulations succeeded")
        return False


def test_sequential_simulations():
    """Test 5 sequential simulations to check for performance degradation"""
    print("\n🔄 Testing 5 sequential simulations...")

    request_data = {
        "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "to": "0x0000000000000000000000000000000000000001",
        "value": "0x16345785d8a0000",
        "chain": "sepolia"
    }

    durations = []

    for i in range(5):
        start = time.time()
        response = requests.post(f"{BASE_URL}/transaction", json=request_data)
        duration = time.time() - start
        durations.append(duration)

        if response.status_code != 200:
            print(f"❌ Request {i+1} failed: {response.status_code}")
            return False

    avg_duration = sum(durations) / len(durations)
    max_duration = max(durations)
    min_duration = min(durations)

    print(f"   Durations: {[f'{d:.3f}s' for d in durations]}")
    print(f"   Average: {avg_duration:.3f}s | Min: {min_duration:.3f}s | Max: {max_duration:.3f}s")

    if max_duration < 2.0:
        print(f"✅ All simulations under 2s")
        return True
    else:
        print(f"❌ Some simulations exceeded 2s")
        return False


def main():
    """Run all performance tests"""
    print("🧪 Transaction Simulation Performance Test Suite")
    print("="*60)
    print("Testing that simulations meet the <2s performance requirement")
    print("="*60 + "\n")

    tests = [
        ("Single Simulation <2s", test_single_simulation_performance),
        ("10 Concurrent Simulations", test_concurrent_simulations),
        ("5 Sequential Simulations", test_sequential_simulations),
    ]

    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name} crashed: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))

    print("\n" + "="*60)
    print("\n📊 Performance Test Results:")
    passed = sum(1 for _, r in results if r)
    total = len(results)

    for name, result in results:
        status = "✅" if result else "❌"
        print(f"  {status} {name}")

    print(f"\n🎯 {passed}/{total} performance tests passed")

    if passed == total:
        print("\n🎉 All performance requirements met! (<2s simulations)")
        return 0
    else:
        print("\n⚠️ Some performance tests failed. Optimization needed.")
        return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)