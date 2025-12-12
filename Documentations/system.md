# 📄 System Architecture & Implementation Guide

> **Project**: SafeBox - Disposable Browser & AI Link Analyzer
> **Goal**: Provide users with a secure environment to open suspicious links using disposable containers, routed via Traefik, and analyzed by an AI system.
> **Version**: v1.0
> **Last Updated**: July 18, 2025

---

## 📦 1. Tech Stack Overview

| Component                | Tech/Tool                             | Description                                             |
| ------------------------ | ------------------------------------- | ------------------------------------------------------- |
| Backend API              | **Node.js (Express)**                 | Handles browser sessions, lifecycle, and orchestration. |
| Disposable Browser       | `linuxserver/chromium` Docker Image   | Full GUI Chromium browser running in container.         |
| Reverse Proxy / TLS      | **Traefik + DuckDNS + Let's Encrypt** | Routes container to public subdomain securely.          |
| AI Analyzer              | **Python (FastAPI) + Transformers**   | Analyzes web page content via scraped data.             |
| Container Runtime        | **Docker Engine + Docker Compose**    | Manages isolated environments.                          |
| Chrome Extension         | JavaScript + Manifest V3              | Allows right-click “Open in Safe Browser”.              |
| Frontend Dashboard       | React + Tailwind CSS                  | View session logs, analysis feedback.                   |
| Message Queue (optional) | Redis                                 | Task coordination between services.                     |
| Database (optional)      | MongoDB / PostgreSQL                  | Store user sessions and analysis logs.                  |

---

## ⚙️ 2. Backend API Design

### Base URL

```
https://disposable-services.duckdns.org/api/browser
```

### 📍 Endpoints

#### `POST /spawn`

Spin up a new disposable browser for a given URL.

```bash
POST /api/browser/spawn
```

**Request Body**

```json
{
  "url": "https://suspicious.example.com",
  "userId": "abc123"
}
```

**Response**

```json
{
  "sessionId": "session_xyz",
  "browserUrl": "https://session_xyz.disposable-services.duckdns.org",
  "expiresIn": 600
}
```

---

#### `POST /extend`

Extend session timeout (e.g., by 10 mins).

```bash
POST /api/browser/extend
```

**Request Body**

```json
{
  "sessionId": "session_xyz",
  "extraTime": 600
}
```

---

#### `POST /stop`

Stop and clean up a browser session.

```bash
POST /api/browser/stop
```

**Request Body**

```json
{
  "sessionId": "session_xyz"
}
```

---

#### `GET /status/:sessionId`

Get status of a browser session.

```bash
GET /api/browser/status/session_xyz
```

---

#### `GET /analysis/:sessionId`

Retrieve AI analysis report.

```bash
GET /api/browser/analysis/session_xyz
```

---

## 🐳 3. Docker & Traefik Integration

### Example `docker-compose.yml`

```yaml
version: "3.9"

services:
  traefik:
    image: traefik:v2.11
    command:
      - "--api.insecure=false"
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.myresolver.acme.tlschallenge=true"
      - "--certificatesresolvers.myresolver.acme.email=you@example.com"
      - "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./letsencrypt:/letsencrypt"
    labels:
      - "traefik.enable=true"
    restart: always

  chromium-session:
    image: linuxserver/chromium
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=UTC
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.session_xyz.rule=Host(`session_xyz.disposable-services.duckdns.org`)"
      - "traefik.http.routers.session_xyz.entrypoints=websecure"
      - "traefik.http.routers.session_xyz.tls.certresolver=myresolver"
    restart: always
    shm_size: "2gb"
```

---

## 🤖 4. AI Analyzer Subsystem

### Architecture Flow

1. Chromium container launches and navigates to URL.
2. Puppeteer/Playwright inside AI service scrapes DOM.
3. Sends text + metadata to classifier.
4. Classifier returns:

   * Trust score (0–100)
   * Category: \[phishing, documentation, scam, tech, spam]
   * Risk flags: \[script injection, iframe abuse, URL redirectors]

---

### AI Model Design

#### Input

* URL
* Text content scraped from page
* Metadata: number of forms, input fields, domains, etc.

#### Output

```json
{
  "trustScore": 23,
  "category": "phishing",
  "flags": ["obfuscated URLs", "login form", "hidden redirect"]
}
```

---

### Model Architecture

* **Base Model**: `distilbert-base-uncased`
* **Fine-tuned** for:

  * Link classification (`phishing`, `scam`, `legit`)
  * NLP analysis of form content, page layout
* **Optional**: multimodal classification using screenshots via CLIP

---

### Dataset

Use:

* [OpenPhish](https://openphish.com/)
* [PhishTank](https://phishtank.org/)
* Common Crawl
* GitHub `README.md` corpus for documentation class
* Kaggle's malicious URLs datasets

---

### Training Script (PyTorch + Transformers)

```python
from transformers import DistilBertForSequenceClassification, Trainer, TrainingArguments, DistilBertTokenizer
from datasets import load_dataset

model = DistilBertForSequenceClassification.from_pretrained("distilbert-base-uncased", num_labels=3)
tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")

dataset = load_dataset("csv", data_files={"train": "./data/train.csv", "test": "./data/test.csv"})

def tokenize(batch):
    return tokenizer(batch["text"], truncation=True, padding=True)

encoded = dataset.map(tokenize, batched=True)
args = TrainingArguments(
    output_dir="./results",
    evaluation_strategy="epoch",
    per_device_train_batch_size=16,
    num_train_epochs=3,
    weight_decay=0.01
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=encoded["train"],
    eval_dataset=encoded["test"]
)

trainer.train()
```

---

### Deployment

* Serve model via **FastAPI** or **Flask** API.
* Run in separate container.
* Use `/analyze` endpoint to classify DOM content.

---

## 🔄 5. Full Workflow

```plaintext
[User clicks link in Chrome]
        ↓
[Extension calls /api/browser/spawn]
        ↓
[Backend spins up container with Chromium]
        ↓
[Traefik exposes container via subdomain]
        ↓
[User navigates safely inside container]
        ↓
[AI Analyzer watches content, classifies link]
        ↓
[Extension/dashboard displays results]
        ↓
[Session auto-stops OR user extends/stops manually]
```

---

## 🔐 6. Security Checklist

| Feature                      | Description                               |
| ---------------------------- | ----------------------------------------- |
| 🔒 TLS via Traefik + DuckDNS | Automatic Let's Encrypt certs             |
| 🔥 Ephemeral Containers      | Auto-delete on inactivity or user command |
| 🚫 No Volume Mounts          | Prevent data leaks outside container      |
| ✅ CORS Strict Rules          | API is locked down to frontend origin     |
| 🔑 Session Tokens (optional) | Tokenize access per browser instance      |

---

## 📈 7. Metrics

| Metric               | Target                 |
| -------------------- | ---------------------- |
| Avg. browser spin-up | < 5 seconds            |
| AI response latency  | < 2 seconds            |
| Container lifetime   | ≤ 10 minutes (default) |
| AI model accuracy    | > 90%                  |
| Concurrent sessions  | \~100 (based on infra) |

---

✅ **Next Steps**:
Once you're done reviewing this document, I can deliver:

1. `Document 2` – 📋 Product Requirements (PRD)
2. `Document 3` – ✅ Task Breakdown & Milestone Plan (in Markdown)

