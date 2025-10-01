
# Start from official Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy dependencies first for Docker layer cache
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY main.py ./

# Expose port for Uvicorn
EXPOSE 8000

# Entrypoint to run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
