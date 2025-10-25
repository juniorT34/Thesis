#!/usr/bin/env python3
"""
Test script for the ML Phishing Detection Service
"""

import requests
import json
import time

def test_health_endpoint():
    """Test the health endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get("http://localhost:8001/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_phishing_analysis():
    """Test phishing analysis with various URLs"""
    print("\nTesting phishing analysis...")
    
    test_cases = [
        {
            "name": "Legitimate URL",
            "request": {
                "url": "https://www.google.com",
                "title": "Google",
                "text": "Search the world's information, including webpages, images, videos and more."
            }
        },
        {
            "name": "Suspicious URL",
            "request": {
                "url": "https://secure-bank-login.tk/verify-account",
                "title": "Verify Your Account",
                "text": "Click here to verify your bank account immediately or it will be suspended."
            }
        },
        {
            "name": "URL Only",
            "request": {
                "url": "https://paypal-security-update.ml/login"
            }
        }
    ]
    
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
                print(f"✅ Analysis successful:")
                print(f"   URL: {test_case['request']['url']}")
                print(f"   Is Phishing: {data['is_phishing']}")
                print(f"   Confidence: {data['confidence']:.3f}")
                print(f"   Risk Score: {data['risk_score']:.3f}")
                print(f"   Message: {data['message']}")
            else:
                print(f"❌ Analysis failed: {response.status_code}")
                print(f"   Response: {response.text}")
                
        except Exception as e:
            print(f"❌ Analysis error: {e}")

def test_model_loading():
    """Test if model is loaded properly"""
    print("\nTesting model loading...")
    try:
        response = requests.get("http://localhost:8001/health")
        if response.status_code == 200:
            data = response.json()
            if data.get("model_loaded"):
                print("✅ Model loaded successfully")
                print(f"   Device: {data.get('device', 'unknown')}")
                return True
            else:
                print("❌ Model not loaded")
                return False
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Model loading test error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing ML Phishing Detection Service")
    print("=" * 50)
    
    # Wait a moment for service to start
    print("Waiting for service to start...")
    time.sleep(5)
    
    # Test health endpoint
    health_ok = test_health_endpoint()
    
    if not health_ok:
        print("\n❌ Service is not running. Please start the service first:")
        print("   python main.py")
        return
    
    # Test model loading
    model_ok = test_model_loading()
    
    if not model_ok:
        print("\n❌ Model is not loaded. Please check the service logs.")
        return
    
    # Test phishing analysis
    test_phishing_analysis()
    
    print("\n🎉 All tests completed!")

if __name__ == "__main__":
    main()
