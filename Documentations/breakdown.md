
---

# ✅ Task Breakdown & Development Plan

> **Project**: SafeBox – Disposable Browser with AI Link Analysis
> **Version**: v1.0
> **Last Updated**: July 18, 2025

---

## 📌 Overview

This document outlines:

* Key tasks by component
* Development phases
* Dependencies
* Timeline suggestions (optional weekly roadmap)

---

## 🧱 1. Backend API (Node.js + Docker Integration)

### Core Responsibilities

* Manage disposable Chromium sessions
* Control lifecycle: spawn, extend, stop
* Interface with Traefik routing
* Connect with AI analyzer service

### Tasks

| Task ID | Task Description               | API Endpoint                       | Priority | Notes                                  |
| ------- | ------------------------------ | ---------------------------------- | -------- | -------------------------------------- |
| B-01    | Create `POST /spawn` endpoint  | `/api/browser/spawn`               | ⭐️ High  | Launch browser container via Dockerode |
| B-02    | Create `POST /stop` endpoint   | `/api/browser/stop`                | ⭐️ High  | Kill container and cleanup             |
| B-03    | Create `POST /extend` endpoint | `/api/browser/extend`              | ⭐️ High  | Update container TTL                   |
| B-04    | Create `GET /status/:id`       | `/api/browser/status/:sessionId`   | ✅ Medium | Return container health                |
| B-05    | Create `GET /analysis/:id`     | `/api/browser/analysis/:sessionId` | ⭐️ High  | Pull results from AI service           |
| B-06    | Add container TTL manager      | —                                  | ✅ Medium | Auto-kill expired containers           |
| B-07    | Integrate Traefik labels       | —                                  | ⭐️ High  | Use Docker labels for routing          |
| B-08    | Add logging & error handling   | —                                  | ✅ Medium | Use `winston` or `pino`                |
| B-09    | Add session ID/token logic     | —                                  | ✅ Medium | Use UUIDs with optional secrets        |

---

## 🧠 2. AI Analyzer (Python + Transformers)

### Core Responsibilities

* Receive URL or page DOM from backend
* Extract relevant features (text, metadata)
* Classify content via finetuned transformer
* Return trust score + risk flags

### Tasks

| Task ID | Task Description                | Endpoint   | Priority | Notes                             |
| ------- | ------------------------------- | ---------- | -------- | --------------------------------- |
| A-01    | Setup FastAPI project           | `/analyze` | ⭐️ High  | Lightweight async API             |
| A-02    | Build feature extractor         | —          | ⭐️ High  | Use BeautifulSoup or Playwright   |
| A-03    | Integrate DistilBERT            | —          | ⭐️ High  | Load finetuned model checkpoint   |
| A-04    | Create risk flag rules          | —          | ✅ Medium | Use regex and form detection      |
| A-05    | Add `POST /analyze` API         | `/analyze` | ⭐️ High  | Accept JSON (text, metadata)      |
| A-06    | Return structured output        | —          | ⭐️ High  | JSON: trustScore, flags, category |
| A-07    | Prepare training script         | —          | ⭐️ High  | Use HuggingFace Trainer API       |
| A-08    | Collect + clean datasets        | —          | ⭐️ High  | OpenPhish, Common Crawl, GitHub   |
| A-09    | Train model locally or in cloud | —          | ⭐️ High  | Use Colab/AWS/GPU box             |
| A-10    | Containerize analyzer           | —          | ✅ Medium | Add Dockerfile, expose port       |

---

## 🧪 3. Disposable Browser Runtime

### Core Responsibilities

* Launch Chromium in Docker container
* Allow VNC/GUI access
* Route through subdomain via Traefik

### Tasks

| Task ID | Task Description                          | Tool                    | Priority | Notes                         |
| ------- | ----------------------------------------- | ----------------------- | -------- | ----------------------------- |
| D-01    | Add Chromium service to compose           | `linuxserver/chromium`  | ⭐️ High  | Use container labels          |
| D-02    | Setup DuckDNS + Traefik routing           | Traefik                 | ⭐️ High  | Subdomain per session         |
| D-03    | Configure auto TLS (Let's Encrypt)        | Traefik                 | ⭐️ High  | Secure HTTPS routing          |
| D-04    | Support custom hostname (optional)        | Traefik                 | ✅ Medium | e.g., `session123.domain.tld` |
| D-05    | Enable clipboard/input support (optional) | —                       | ✅ Low    | Advanced UX feature           |
| D-06    | Add `shm_size`, memory limits             | Docker                  | ✅ Medium | Prevent browser crashes       |
| D-07    | Build container reaper logic              | Cron or backend service | ⭐️ High  | Auto-kill inactive containers |

---

## 🌐 4. Chrome Extension

### Core Responsibilities

* Capture right-clicks on links
* Call backend with link
* Display AI analysis result

### Tasks

| Task ID | Task Description             | Area         | Priority | Notes                      |
| ------- | ---------------------------- | ------------ | -------- | -------------------------- |
| E-01    | Add right-click context menu | JS           | ⭐️ High  | `"Open in SafeBox"`        |
| E-02    | Send link to backend API     | `fetch`      | ⭐️ High  | Call `/api/browser/spawn`  |
| E-03    | Open disposable browser tab  | Browser tab  | ⭐️ High  | Navigate to subdomain      |
| E-04    | Show AI results popup        | UI           | ✅ Medium | Optional popup on response |
| E-05    | Add token storage (optional) | LocalStorage | ✅ Medium | For authenticated use      |
| E-06    | Setup manifest.json v3       | —            | ⭐️ High  | Chrome extension manifest  |

---

## 📊 5. Frontend Dashboard (Optional Phase 2)

### Core Responsibilities

* Allow users to view their session history
* Show AI results
* Provide stop/extend buttons

### Tasks

| Task ID | Task Description               | Tech  | Priority | Notes                  |
| ------- | ------------------------------ | ----- | -------- | ---------------------- |
| F-01    | Build session list view        | React | ✅ Medium | Requires backend data  |
| F-02    | Show AI result viewer          | React | ✅ Medium | Show category, flags   |
| F-03    | Add stop/extend buttons        | React | ✅ Medium | Integrate backend APIs |
| F-04    | Add login/session token system | JWT   | ✅ Low    | Optional for user auth |

---

## 🛠️ 6. DevOps & Infrastructure

| Task ID | Task Description                | Tool                    | Priority | Notes                     |
| ------- | ------------------------------- | ----------------------- | -------- | ------------------------- |
| I-01    | Install Docker + Docker Compose | —                       | ⭐️ High  | Host machine setup        |
| I-02    | Setup Traefik with DuckDNS      | Traefik                 | ⭐️ High  | Public access w/ certs    |
| I-03    | Setup `.env` config             | Docker                  | ✅ Medium | Shared secrets, base URLs |
| I-04    | Add restart policies            | Docker                  | ✅ Medium | Ensure resiliency         |
| I-05    | Add monitoring stack (optional) | Grafana/Loki            | ✅ Low    | Logs & metrics            |
| I-06    | Set up logging to file/console  | Winston, Python logging | ⭐️ High  | Trace errors/debugging    |

---

## 🧪 7. Testing

| Task ID | Task Description                                     | Scope      | Priority | Notes                        |
| ------- | ---------------------------------------------------- | ---------- | -------- | ---------------------------- |
| T-01    | Unit tests for backend API                           | Node.js    | ⭐️ High  | Jest or Mocha                |
| T-02    | Integration test: spawn → route → browser → analysis | Full stack | ⭐️ High  | End-to-end                   |
| T-03    | Model inference test                                 | Python     | ⭐️ High  | Send test inputs to analyzer |
| T-04    | Extension test on Chrome                             | Browser    | ⭐️ High  | Context menu, tab open       |
| T-05    | Stress test concurrent sessions                      | Docker     | ✅ Medium | 10–100 browser containers    |
| T-06    | Security test: CORS, subdomain spoofing              | Backend    | ⭐️ High  | Use OWASP ZAP if needed      |

---

## 🗓️ 8. Suggested Timeline (By Week)

| Week | Focus Area            | Milestone                                |
| ---- | --------------------- | ---------------------------------------- |
| 1    | Infra setup           | Docker, Traefik, DuckDNS ready           |
| 2    | Backend MVP           | `/spawn`, `/stop`, routing done          |
| 3    | AI Analyzer Prototype | FastAPI + simple model returns mock data |
| 4    | Chrome Extension      | Right-click flow working                 |
| 5    | AI Model Training     | Finetuned BERT ready for integration     |
| 6    | Full integration      | Extension → backend → browser → AI → UI  |
| 7    | Dashboard (optional)  | React view + session control             |
| 8    | Testing + Hardening   | Unit tests, cleanup, edge cases          |
| 9    | Deployment & Ship     | Hosted on public IP                      |

---

## 🔚 Conclusion

This task breakdown provides a clear map to build **SafeBox**, starting with the backend and AI system. With strong modularity and container-based orchestration, each part of the system is testable, replaceable, and future-proof.

---
