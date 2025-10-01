from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

#input data moodel for the API

class PredictRequest(BaseModel):
    text: str

class PredictResponse(BaseModel):
    phishing_probability: float
    prediction: str 

app = FastAPI(
    title="Phishing Detection ML API",
    description="An API for detecting phishing in text using a pre-trained ML model.",
    version="1.0.0"
)

# Load the pre-trained model and tokenizer
@app.on_event("startup")
def load_model():
    model_name = "ealvaradob/bert-finetuned-phishing"

    app.tokenizer = AutoTokenizer.from_pretrained(model_name)
    app.model = AutoModelForSequenceClassification.from_pretrained(model_name)
    app.model.eval()


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    try:
        inputs = app.tokenizer(request.text,return_tensors="pt", truncation=True, padding=True)

        with torch.no_grad():
            logits = app.model(**inputs).logits
            #apply softmax to get probabilities
            probabilities = torch.nn.functional.softmax(logits, dim=1)[0]

            phishing_prob = float(probabilities[1].item)
            prediction = "phishing" if phishing_prob > 0.5 else "not phishing"

            return PredictResponse(
                phishing_probability=phishing_prob,
                prediction=prediction
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/")
def read_root():
    return {"message": "Welcome to the Phishing Detection ML API. Use the /predict endpoint to analyze text."}

