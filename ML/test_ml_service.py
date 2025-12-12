#!/usr/bin/env python3
"""
Comprehensive test script for the ML Phishing Detection Service
"""

import requests
import json
import time

def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get("http://localhost:8001/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return data.get("model_loaded", False)
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_phishing_detection():
    """Test phishing detection with various URLs"""
    print("\nTesting phishing detection...")
    
    test_cases = [
        {
            "name": "Obvious Phishing",
            "request": {
                "url": "https://paypal-security-update.ml/login",
                "title": "PayPal Security Update",
                "text": "Your PayPal account will be suspended if you don't verify immediately. Click here now!"
            },
            "expected_phishing": True
        },
        {
            "name": "Safe URL",
            "request": {
                "url": "https://www.google.com",
                "title": "Google",
                "text": "Search the world's information, including webpages, images, videos and more."
            },
            "expected_phishing": False
        },
        {
            "name": "Suspicious Bank URL",
            "request": {
                "url": "https://secure-bank-login.tk/verify-account",
                "title": "Verify Your Account",
                "text": "Click here to verify your bank account immediately or it will be suspended."
            },
            "expected_phishing": True
        }
    ]
    
    results = []
    
    for test_case in test_cases:
        print(f"\n--- Testing: {test_case['name']} ---")
        try:
            response = requests.post(
                "http://localhost:8001/analyze",
                json=test_case["request"],
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                is_phishing = data['is_phishing']
                confidence = data['confidence']
                risk_score = data['risk_score']
                message = data['message']
                model_used = data['details']['model_used']
                
                print(f"✅ Analysis successful:")
                print(f"   URL: {test_case['request']['url']}")
                print(f"   Is Phishing: {is_phishing}")
                print(f"   Confidence: {confidence:.3f}")
                print(f"   Risk Score: {risk_score:.3f}")
                print(f"   Model Used: {model_used}")
                print(f"   Message: {message}")
                
                # Check if result matches expectation
                if is_phishing == test_case['expected_phishing']:
                    print(f"✅ Result matches expectation")
                    results.append(True)
                else:
                    print(f"⚠️ Result doesn't match expectation (expected: {test_case['expected_phishing']})")
                    results.append(False)
                    
            else:
                print(f"❌ Analysis failed: {response.status_code}")
                print(f"   Response: {response.text}")
                results.append(False)
                
        except Exception as e:
            print(f"❌ Analysis error: {e}")
            results.append(False)
    
    return results

def main():
    """Run all tests"""
    print("🧪 Testing ML Phishing Detection Service")
    print("=" * 50)
    
    # Test health endpoint
    model_loaded = test_health()
    
    if not model_loaded:
        print("\n❌ Model is not loaded. Please check the service.")
        return
    
    # Test phishing detection
    results = test_phishing_detection()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    passed = sum(results)
    total = len(results)
    print(f"   Tests passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All tests passed! The ML service is working correctly.")
    else:
        print("⚠️ Some tests failed. Please check the implementation.")

if __name__ == "__main__":
    main()
