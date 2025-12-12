#!/usr/bin/env python3
"""
Test script to verify BERT model loading and inference
"""

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_bert_model():
    """Test BERT model loading and inference"""
    try:
        logger.info("Testing BERT model loading...")
        
        # Set device
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {device}")
        
        # Load model and tokenizer
        model_name = "ealvaradob/bert-finetuned-phishing"
        logger.info(f"Loading model: {model_name}")
        
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
        
        # Move model to device
        model.to(device)
        model.eval()
        
        logger.info("Model loaded successfully!")
        
        # Test inference
        test_text = "Your PayPal account will be suspended if you don't verify immediately. Click here now!"
        
        logger.info(f"Testing inference with text: {test_text}")
        
        # Tokenize input
        inputs = tokenizer(
            test_text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=512
        )
        
        # Move inputs to device
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Run inference
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            
            # Get probabilities
            probabilities = torch.softmax(logits, dim=-1)
            
            # Get prediction (0 = legitimate, 1 = phishing)
            prediction = torch.argmax(probabilities, dim=-1).item()
            confidence = probabilities[0][prediction].item()
            
            # Calculate risk score (0-1 scale)
            risk_score = probabilities[0][1].item()  # Probability of being phishing
            
            is_phishing = prediction == 1
            
            logger.info(f"Results:")
            logger.info(f"  Is Phishing: {is_phishing}")
            logger.info(f"  Confidence: {confidence:.3f}")
            logger.info(f"  Risk Score: {risk_score:.3f}")
            logger.info(f"  Probabilities: {probabilities[0].tolist()}")
            
            return True
            
    except Exception as e:
        logger.error(f"Error testing BERT model: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_bert_model()
    if success:
        print("✅ BERT model test successful!")
    else:
        print("❌ BERT model test failed!")
