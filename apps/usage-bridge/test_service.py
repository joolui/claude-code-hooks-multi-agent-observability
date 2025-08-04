#!/usr/bin/env python3
"""
Simple test script to verify the Usage Bridge service is working correctly.
"""

import requests
import json
import sys
from typing import Dict, Any


def test_endpoint(url: str, method: str = "GET", data: Dict[Any, Any] = None) -> bool:
    """Test a single endpoint and return success status."""
    try:
        print(f"Testing {method} {url}...")
        
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=10)
        else:
            print(f"  ❌ Unsupported method: {method}")
            return False
        
        if response.status_code == 200:
            print(f"  ✅ Success ({response.status_code})")
            return True
        else:
            print(f"  ❌ Failed ({response.status_code}): {response.text[:100]}...")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Connection error: {e}")
        return False
    except Exception as e:
        print(f"  ❌ Unexpected error: {e}")
        return False


def main():
    """Run basic service tests."""
    base_url = "http://localhost:8001"
    
    print("🧪 Testing Usage Bridge Service")
    print(f"Base URL: {base_url}")
    print("-" * 50)
    
    tests = [
        # Basic service tests
        {
            "name": "Health Check",
            "url": f"{base_url}/health",
            "method": "GET"
        },
        {
            "name": "Root Endpoint",
            "url": f"{base_url}/",
            "method": "GET"
        },
        
        # Configuration tests
        {
            "name": "Get Usage Config",
            "url": f"{base_url}/usage/config",
            "method": "GET"
        },
        {
            "name": "Update Usage Config",
            "url": f"{base_url}/usage/config",
            "method": "POST",
            "data": {
                "plan": "custom",
                "custom_limit_tokens": 50000,
                "view": "realtime",
                "timezone": "UTC",
                "time_format": "24h",
                "theme": "dark",
                "refresh_rate": 5,
                "refresh_per_second": 1.0,
                "reset_hour": 0
            }
        },
        
        # Usage statistics tests
        {
            "name": "Get Usage Stats",
            "url": f"{base_url}/usage/stats",
            "method": "GET"
        },
        {
            "name": "Get Usage Stats with Params",
            "url": f"{base_url}/usage/stats?plan=pro&timezone=UTC",
            "method": "GET"
        },
        {
            "name": "Get Usage Sessions",
            "url": f"{base_url}/usage/sessions",
            "method": "GET"
        },
        {
            "name": "Get Usage Sessions (48h)",
            "url": f"{base_url}/usage/sessions?hours_back=48",
            "method": "GET"
        }
    ]
    
    # Run tests
    passed = 0
    total = len(tests)
    
    for test in tests:
        success = test_endpoint(
            test["url"], 
            test.get("method", "GET"), 
            test.get("data")
        )
        if success:
            passed += 1
        print()
    
    # Summary
    print("=" * 50)
    print(f"Test Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All tests passed! Service is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the service configuration.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)