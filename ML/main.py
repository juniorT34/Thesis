from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging
from typing import Optional, Dict, Any
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ML Phishing Detection Service",
    description="BERT-based phishing detection service for disposable services platform",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model and tokenizer
model = None
tokenizer = None
device = None

# Pydantic models for request/response
class PhishingAnalysisRequest(BaseModel):
    url: str
    text: Optional[str] = None
    title: Optional[str] = None

class PhishingAnalysisResponse(BaseModel):
    is_phishing: bool
    confidence: float
    risk_score: float
    message: str
    details: Optional[Dict[str, Any]] = None

@app.on_event("startup")
async def load_model():
    """Load the BERT model and tokenizer on startup"""
    global model, tokenizer, device
    
    try:
        logger.info("Loading BERT phishing detection model...")
        
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
        
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        raise e

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "ML Phishing Detection Service is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "service": "ml-phishing-detector",
        "model_loaded": model is not None,
        "device": str(device) if device else "unknown"
    }

@app.post("/analyze", response_model=PhishingAnalysisResponse)
async def analyze_phishing(request: PhishingAnalysisRequest):
    """
    Analyze a URL/text for phishing using BERT model
    """
    try:
        logger.info(f"Received phishing analysis request for URL: {request.url}")
        
        if model is None or tokenizer is None:
            raise HTTPException(status_code=503, detail="Model not loaded")
        
        # Prepare text for analysis
        analysis_text = _prepare_text_for_analysis(request)
        
        # Run inference
        is_phishing, confidence, risk_score = _run_inference(analysis_text)
        
        # Generate response message
        message = _generate_response_message(is_phishing, confidence, request.url)
        
        # Prepare details
        details = {
            "model_used": "ealvaradob/bert-finetuned-phishing",
            "analysis_text": analysis_text,
            "device": str(device)
        }
        
        result = {
            "is_phishing": is_phishing,
            "confidence": confidence,
            "risk_score": risk_score,
            "message": message,
            "details": details
        }
        
        logger.info(f"Analysis completed for {request.url}: phishing={is_phishing}, confidence={confidence:.3f}")
        return PhishingAnalysisResponse(**result)
        
    except Exception as e:
        logger.error(f"Error analyzing {request.url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

def _prepare_text_for_analysis(request: PhishingAnalysisRequest) -> str:
    """Prepare text for BERT analysis"""
    text_parts = []
    
    # Add URL
    if request.url:
        text_parts.append(f"URL: {request.url}")
    
    # Add title if available
    if request.title:
        text_parts.append(f"Title: {request.title}")
    
    # Add text content if available
    if request.text:
        # Truncate text if too long (BERT has token limits)
        text_content = request.text[:1000] if len(request.text) > 1000 else request.text
        text_parts.append(f"Content: {text_content}")
    
    # If no text content, use URL as primary analysis target
    if not text_parts:
        text_parts.append(request.url)
    
    return " ".join(text_parts)

def _run_inference(text: str) -> tuple[bool, float, float]:
    """Run BERT inference on the text"""
    try:
        # Tokenize input
        inputs = tokenizer(
            text,
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
            
            return is_phishing, confidence, risk_score
            
    except Exception as e:
        logger.error(f"Error during BERT inference: {str(e)}")
        raise e

def _generate_response_message(is_phishing: bool, confidence: float, url: str) -> str:
    """Generate user-friendly response message"""
    if is_phishing:
        if confidence > 0.8:
            return f"⚠️ HIGH RISK: This link appears to be a phishing attempt with {confidence:.1%} confidence. Proceed with extreme caution."
        elif confidence > 0.6:
            return f"⚠️ SUSPICIOUS: This link shows signs of phishing with {confidence:.1%} confidence. Consider avoiding this link."
        else:
            return f"⚠️ POTENTIAL RISK: This link has some suspicious characteristics with {confidence:.1%} confidence."
    else:
        if confidence > 0.8:
            return f"✅ SAFE: This link appears legitimate with {confidence:.1%} confidence."
        elif confidence > 0.6:
            return f"✅ LIKELY SAFE: This link appears to be legitimate with {confidence:.1%} confidence."
        else:
            return f"⚠️ UNCERTAIN: Unable to determine with high confidence. Proceed with caution."

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
