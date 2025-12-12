
---

# 📋 Product Requirements Document (PRD)

> **Product**: SafeBox – Disposable Browser & AI-Powered Link Analyzer
> **Version**: v1.0
> **Last Updated**: July 18, 2025
> **Prepared For**: Developers, Architects, Stakeholders

---

## 🧭 1. Problem Statement

Web users frequently encounter untrusted or suspicious links — in emails, messages, or websites — that may lead to **phishing**, **malware**, or **spam** pages. Traditional browser defenses are limited to preloaded heuristics and offer **no isolated execution**.

There is a clear need for a **disposable, isolated, and AI-enhanced browsing environment** that opens risky links without compromising the user's local device or identity.

---

## 🎯 2. Goals & Objectives

| Objective                      | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| ✅ Disposable Browsers          | Let users open links in ephemeral, containerized Chromium instances    |
| 🔒 Safe Execution Environment  | Prevent data leakage or browser compromise via isolation               |
| 🧠 AI-Based Link Analysis      | Classify the safety, content type, and trustworthiness of opened links |
| 🌐 Seamless Chrome Integration | Enable users to launch disposable browsers directly from Chrome        |
| 📊 Insight & Reporting         | Provide feedback and session history for transparency                  |

---

## 🧩 3. Key Features

### 🔗 Chrome Extension (Client)

* Right-click integration on links (context menu)
* Option: “Open in SafeBox”
* Sends request to backend API with link
* Displays real-time analysis in popup or new tab

### 🧠 AI Link Analyzer

* DOM scraping, text extraction, and metadata parsing
* Classifies link into categories: phishing, docs, spam, tech, unknown
* Provides a **trust score** (0–100), risk flags, and summary

### 🧪 Disposable Browser Containers

* Containers are auto-generated using `linuxserver/chromium`
* Each user session is isolated
* Accessible via unique subdomain (via Traefik & DuckDNS)
* Auto-expiry (default 10 mins), with optional manual extend or stop

### 🌐 Traefik with DuckDNS Integration

* Dynamic router generates public subdomain for each session:

  * e.g., `session_xyz.disposable-services.duckdns.org`
* Secure TLS via Let’s Encrypt
* Automatically removed when session ends

### 📈 Frontend Dashboard (Optional)

* List recent sessions
* View AI analysis results
* Stop or extend browser sessions
* Admin analytics (containers, analysis queue, errors)

---

## 🔐 4. Security Requirements

| Concern             | Solution                                        |
| ------------------- | ----------------------------------------------- |
| Data leakage        | No persistent volumes, isolated containers      |
| HTTPS routing       | Traefik + DuckDNS + Let’s Encrypt               |
| Access control      | Randomized session IDs + optional token auth    |
| Resource abuse      | Auto shutdown inactive containers (timeouts)    |
| Container breakouts | Run with least privileges, no host access       |
| CORS / XSS risks    | Lock API to frontend and extension domains only |

---

## ⚙️ 5. System Architecture Overview

```plaintext
[ Chrome Extension ]
       ↓
[ SafeBox Backend API ]  <--->  [ Docker Engine + Traefik ]
       ↓                             ↓
[ AI Analyzer (Python) ]         [ Chromium Container ]
       ↓                             ↓
[ Analysis Output ]          [ Disposable Browser @ *.duckdns.org ]
```

---

## 🚀 6. User Workflow

### 1. User Flow

1. User right-clicks a link → selects "Open in SafeBox"
2. Extension sends request to `POST /api/browser/spawn`
3. Backend creates a Chromium Docker container and exposes it via Traefik
4. Extension opens new tab to disposable browser at subdomain (e.g., `session_xyz.disposable-services.duckdns.org`)
5. While browsing:

   * AI analyzer inspects content
   * Feedback is shown in extension or dashboard
6. Session auto-expires or user manually stops via `POST /api/browser/stop`

---

### 2. Admin Flow

1. Admin starts core stack via `docker-compose`
2. Users interact with API; AI model runs in Python container
3. Logs available via stdout, optional Grafana/Loki/Prometheus stack
4. Admin can:

   * View active sessions
   * See analysis queue
   * Restart AI service if needed

---

## 📊 7. Metrics & KPIs

| Metric                     | Goal                     |
| -------------------------- | ------------------------ |
| Container spin-up time     | < 5 seconds              |
| AI classification latency  | < 2 seconds              |
| Accuracy of classification | > 90% precision & recall |
| Max concurrent sessions    | 100+ (scalable)          |
| Auto shutdown enforcement  | 100% of expired sessions |
| Session spoofing incidents | 0 (secure ID/token)      |

---

## 📆 8. Deliverables

| Component                | Description                               | Status     |
| ------------------------ | ----------------------------------------- | ---------- |
| Backend API (Node.js)    | Container orchestration + session control | 🟡 Planned |
| AI Analyzer (Python)     | FastAPI + finetuned classifier            | 🟡 Planned |
| Disposable Browser Stack | Traefik + Chromium container              | 🟡 Planned |
| Chrome Extension         | Link capture + UI                         | 🟡 Planned |
| Dashboard (Optional)     | Session manager for users                 | ⚪ Optional |

---

## 🧠 9. AI System Design (Expanded)

### Classification Model

* **Model**: DistilBERT or TinyBERT
* **Classes**: phishing, scam, documentation, spam, tech, unknown
* **Training Data**:

  * OpenPhish / PhishTank (label: phishing)
  * Common Crawl (label: generic)
  * GitHub README files (label: documentation)
  * Spam datasets from Kaggle

### Inputs to Model

* URL
* Extracted page text
* Form metadata (login forms, scripts)
* Outbound domains and links
* Inline JavaScript and iframe count

### Output Example

```json
{
  "trustScore": 14,
  "category": "phishing",
  "riskFlags": ["login field", "hidden redirect", "untrusted domain"],
  "suggestedAction": "Close Immediately"
}
```

### Training Pipeline Summary

```plaintext
1. Scrape dataset into labeled CSV
2. Preprocess:
   - Normalize text
   - Remove HTML tags
3. Tokenize with DistilBERT tokenizer
4. Train using HuggingFace Trainer API
5. Evaluate on labeled test set
6. Save & serve via FastAPI in container
```

---

## 📦 10. Packaging & Deployment

### Domain Setup

* **DuckDNS**: `disposable-services.duckdns.org`
* DNS points to public IP of Docker host (dynamic IP with DuckDNS client)
* TLS certs via Traefik’s Let’s Encrypt resolver

### Build & Deploy Instructions

```bash
# 1. Clone repo
git clone https://github.com/your-org/safebox
cd safebox

# 2. Set up environment
cp .env.example .env

# 3. Start Traefik and base services
docker-compose up -d traefik api ai-analyzer

# 4. Test endpoint
curl -X POST https://disposable-services.duckdns.org/api/browser/spawn
```

---

## ✅ Summary

This PRD defines the foundation for building **SafeBox**, a hybrid system combining Docker isolation, browser virtualization, AI-based link safety, and Chrome UX integration. It prioritizes security, ease-of-use, and intelligent insight.

---

