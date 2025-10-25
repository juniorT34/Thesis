# ML Phishing Detection Service

This service provides real-time phishing detection using a pre-trained BERT model (`ealvaradob/bert-finetuned-phishing`) for the disposable services platform.

## Features

- **BERT-based Phishing Detection**: Uses a fine-tuned BERT model specifically trained for phishing detection
- **Real-time Analysis**: Fast inference for URL and text analysis
- **Confidence Scoring**: Provides confidence levels and risk scores
- **User-friendly Messages**: Clear, actionable feedback for users
- **RESTful API**: FastAPI-based service with comprehensive endpoints

## Setup

### Prerequisites

- Python 3.11+
- Docker (optional, for containerization)
- CUDA (optional, for GPU acceleration)

### Local Development

1. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the service**:
   ```bash
   python main.py
   ```

The service will be available at `http://localhost:8001`

### Docker Setup

1. **Build the image**:
   ```bash
   docker build -t ml-phishing-detector .
   ```

2. **Run the container**:
   ```bash
   docker run -p 8001:8001 ml-phishing-detector
   ```

## API Endpoints

### Health Check
```
GET /health
```
Returns service health status and model loading information.

**Response**:
```json
{
  "status": "healthy",
  "service": "ml-phishing-detector",
  "model_loaded": true,
  "device": "cpu"
}
```

### Analyze for Phishing
```
POST /analyze
```

**Request Body**:
```json
{
  "url": "https://example.com",
  "title": "Example Website",
  "text": "Optional text content to analyze"
}
```

**Response**:
```json
{
  "is_phishing": false,
  "confidence": 0.95,
  "risk_score": 0.05,
  "message": "✅ SAFE: This link appears legitimate with 95.0% confidence.",
  "details": {
    "model_used": "ealvaradob/bert-finetuned-phishing",
    "analysis_text": "URL: https://example.com Title: Example Website",
    "device": "cpu"
  }
}
```

## Model Information

- **Model**: `ealvaradob/bert-finetuned-phishing`
- **Type**: BERT-based sequence classification
- **Task**: Binary classification (legitimate vs phishing)
- **Input**: Text (URL, title, content)
- **Output**: Phishing probability and confidence score

## Integration with Disposable Services

This service integrates with the main backend API to provide real-time phishing detection when users right-click links. The workflow is:

1. User right-clicks a link in the browser
2. Chrome extension sends the URL to the backend
3. Backend forwards the URL to this ML service
4. ML service analyzes the URL and returns results
5. Backend stores results and opens the disposable browser
6. User sees phishing analysis results in the interface

## Response Messages

The service provides user-friendly messages based on the analysis:

- **HIGH RISK**: >80% confidence of phishing
- **SUSPICIOUS**: 60-80% confidence of phishing  
- **POTENTIAL RISK**: <60% confidence of phishing
- **SAFE**: >80% confidence of legitimate
- **LIKELY SAFE**: 60-80% confidence of legitimate
- **UNCERTAIN**: <60% confidence either way

## Performance

- **Model Loading**: ~10-30 seconds on first startup
- **Inference Time**: ~100-500ms per request (CPU)
- **Memory Usage**: ~1-2GB RAM for model
- **GPU Support**: Automatic detection and usage if available

## Testing

### Manual Testing
```bash
# Test health endpoint
curl http://localhost:8001/health

# Test analysis endpoint
curl -X POST http://localhost:8001/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Automated Testing
```bash
python test_service.py
```

## Security Considerations

- Service runs in isolated container
- No persistent storage of analyzed data
- Input validation and sanitization
- CORS configuration for production
- Rate limiting (to be implemented)

## Development

### Project Structure
```
ML/
├── main.py              # FastAPI application
├── requirements.txt     # Python dependencies
├── Dockerfile          # Container configuration
├── test_service.py     # Test script
└── README.md          # This file
```

### Adding New Features

1. **Model Updates**: Replace model name in `load_model()` function
2. **Response Messages**: Modify `_generate_response_message()` function
3. **Text Preprocessing**: Update `_prepare_text_for_analysis()` function

## Monitoring

- Structured logging for all requests
- Error tracking and reporting
- Health check endpoint
- Model loading status
- Performance metrics (to be implemented)

## Troubleshooting

### Common Issues

1. **Model Loading Fails**: Check internet connection and HuggingFace access
2. **CUDA Errors**: Ensure PyTorch CUDA version matches system
3. **Memory Issues**: Reduce batch size or use CPU-only mode
4. **Slow Inference**: Consider GPU acceleration or model optimization

### Logs

Check service logs for detailed error information:
```bash
# Docker logs
docker logs <container_id>

# Local logs
# Check console output when running python main.py
```
