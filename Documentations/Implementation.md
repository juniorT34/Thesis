# Implementation Plan for SafeBox – Disposable Browser & AI Link Analyzer

> **Current Focus:** This implementation plan is currently scoped **exclusively to the backend system** (Node.js API, Docker orchestration, Traefik integration, session management, and security). All tasks and subtasks below pertain only to backend development. AI analyzer, extension, and frontend/dashboard work will be addressed in future phases.

## Feature Analysis

### Identified Features

- **Disposable Browsers**: Ephemeral, containerized Chromium instances for opening untrusted links.
- **Safe Execution Environment**: Isolated containers, no persistent storage, secure by design.
- **AI-Based Link Analysis**: DOM scraping, text extraction, metadata parsing, and classification (phishing, docs, spam, tech, unknown) with trust score and risk flags.
- **Traefik with DuckDNS Integration**: Dynamic subdomain routing, secure TLS via Let's Encrypt, auto-removal on session end.
- **Session Lifecycle Management**: Auto-expiry, manual extend/stop, session status, and health checks.
- **API Endpoints**: For spawning, stopping, extending, and analyzing browser sessions.
- **Logging & Error Handling**: Centralized logging for debugging and monitoring.
- **Security Controls**: CORS, session tokens, resource abuse prevention.
- **(Optional) Frontend Dashboard**: Session history, AI results, admin analytics.

### Feature Categorization

- **Must-Have Features:**
  - Disposable browser orchestration (spawn, stop, extend)
  - Traefik + DuckDNS integration for secure routing
  - AI-based link analysis (backend integration)
  - API endpoints for session management
  - Security: isolation, CORS, session tokens
  - Logging and error handling
- **Should-Have Features:**
  - Session status/health endpoint
  - Admin analytics/logs
  - Container TTL manager
  - Monitoring stack (Grafana/Loki)
- **Nice-to-Have Features:**
  - Frontend dashboard for users/admins
  - Advanced UX (clipboard/input support)
  - Custom hostname support

## Recommended Tech Stack

### Backend

- **Framework:** Node.js (Express) – Robust, async, widely supported for API and Docker orchestration.
- **Documentation:** <https://expressjs.com/>

### Container Orchestration

- **Docker Engine + Docker Compose** – For isolated Chromium sessions and service management.
- **Documentation:** <https://docs.docker.com/>

### Reverse Proxy & Routing

- **Traefik** – Dynamic routing, TLS, DuckDNS integration.
- **Documentation:** <https://doc.traefik.io/traefik/>
- **DuckDNS:** <https://www.duckdns.org/>

### AI Analyzer

- **Python (FastAPI) + Transformers (HuggingFace)** – For link analysis and classification.
- **Documentation:** <https://fastapi.tiangolo.com/> | <https://huggingface.co/docs/transformers/index>

### Logging/Monitoring

- **Winston (Node.js), Python logging, Grafana/Loki (optional)**
- **Documentation:** <https://github.com/winstonjs/winston> | <https://grafana.com/oss/loki/>

### Database (Optional)

- **MongoDB/PostgreSQL** – For session and analysis logs if persistence is needed.
- **Documentation:** <https://www.mongodb.com/docs/> | <https://www.postgresql.org/docs/>

## Implementation Stages

### Stage 1: Foundation & Setup (Backend Only)

**Duration:** 1 week
**Dependencies:** None

#### Sub-steps

- [x] Set up Node.js development environment
  - [x] Install Node.js LTS and npm
  - [x] Initialize backend project with `npm init`
  - [x] Set up version control (Git)
- [x] Create backend project structure
  - [x] Create folders: controllers, routes, services, middlewares, utils, config, tests
  - [x] Add initial `package.json` and `.env.example`
- [x] Configure Docker Compose for backend, Chromium, and Traefik
  - [x] Write `docker-compose.yml` for backend and Chromium container
  - [x] Add Traefik service and config
- [x] Set up environment variables and secrets management
  - [x] Define required env vars in `.env.example`
  - [x] Integrate dotenv in backend
- [x] Implement basic logging (Winston)
  - [x] Add Winston logger utility
  - [x] Integrate logger in Express app

### Stage 2: Core Backend Features (Detailed Breakdown)

**Duration:** 2 weeks
**Dependencies:** Stage 1 completion

#### Sub-steps

- [x] Implement `POST /api/browser/spawn` (launch Chromium container)
  - [x] Define route and controller
  - [x] Integrate Dockerode to launch container
  - [x] Generate unique session ID
  - [x] Attach Traefik labels for routing
  - [x] Return session info (ID, URL, expiry)
- [x] Implement `POST /api/browser/stop` (terminate container)
  - [x] Define route and controller
  - [x] Validate session ID
  - [x] Stop and remove Docker container
  - [x] Clean up Traefik routing
- [x] Implement `POST /api/browser/extend` (update TTL)
  - [x] Define route and controller
  - [x] Validate session ID
  - [x] Update container TTL/expiry
- [x] Integrate Traefik labels for dynamic routing
  - [x] Add label generation utility
  - [x] Ensure labels are set on container creation
- [x] Implement container TTL manager (auto-kill expired sessions)
  - [x] Create background job/service
  - [x] Track session expiry times
  - [x] Stop/remove expired containers
- [x] Add session ID/token logic (UUID, optional secrets)
  - [x] Use UUID for session IDs
  - [x] (Optional) Add token-based access for session endpoints
- [x] Implement logging and error handling
  - [x] Add error middleware in Express
  - [x] Log all errors and key events
- [x] Implement `GET /api/browser/status/:sessionId` (container health)
  - [x] Define route and controller
  - [x] Query Docker for container status
  - [x] Return health/status info

### Stage 3: (Deferred) AI Analyzer Integration

> **Note:** AI analyzer integration and related endpoints are out of scope for this backend-only phase. See future plan for details.

### Stage 4: Polish, Security & Optimization (Backend Only)

**Duration:** 1 week
**Dependencies:** Stage 2 completion

#### Sub-steps

- [x] Harden backend security
  - [x] Implement CORS with strict origin rules
  - [x] Add session token validation (if applicable)
  - [x] Set resource limits for containers
- [x] Add monitoring/logging improvements
  - [x] Integrate request logging middleware
  - [x] Add health check endpoint for backend
- [x] Conduct backend unit and integration testing
  - [x] Write Jest/Mocha tests for all routes and services
  - [x] Add test cases for error scenarios
- [x] Optimize backend performance
  - [x] Profile container spin-up time
  - [x] Tune Docker/Traefik configs for speed
- [x] Prepare backend deployment scripts and documentation
  - [x] Write backend deployment guide
  - [x] Document all environment variables
- [x] Review and document error handling in Bug_tracking.md
  - [x] Log all known backend issues and solutions

### Stage 5: (Deferred) Frontend Dashboard & Extension

> **Note:** Frontend and extension development are out of scope for this backend-only phase. See future plan for details.

### Stage 6: Chrome Extension Development

**Duration:** 1 week
**Dependencies:** Backend API (Stages 1–4) must be functional and accessible

#### Sub-steps

- [x] Set up Chrome extension project structure
  - [x] Create extension folder and initial manifest.json (Manifest V3)
  - [x] Set up build tooling (Webpack with TypeScript support)
- [x] Implement comprehensive service management UI
  - [x] Create popup interface for browser, desktop, and viewer services
  - [x] Implement service start/stop/extend functionality
  - [x] Add session timer and status monitoring
  - [x] Create machine type selector for desktop service
- [x] Implement backend API communication
  - [x] Create API client for all service endpoints
  - [x] Handle API responses (session URL, errors, status)
  - [x] Implement retry logic and error handling
- [x] Implement service session management
  - [x] Open new tabs to service URLs automatically
  - [x] Handle session expiry and cleanup
  - [x] Implement session extension functionality
- [x] Add comprehensive error handling and user feedback
  - [x] Show error messages for failed API calls
  - [x] Implement loading states and notifications
  - [x] Add session status indicators
- [x] Implement extension settings and storage
  - [x] Store session data and settings in chrome.storage.local
  - [x] Handle theme switching (light/dark mode)
  - [x] Manage API configuration
- [x] Add file viewer upload interface
  - [x] Create drag-and-drop file upload page
  - [x] Handle file selection and viewer service launch
- [x] Implement right-click context menu integration
  - [x] Add context menu item: "Open in SafeBox"
  - [x] Handle link selection and extraction
- [x] Test extension in Chrome (manual and automated tests)
  - [x] Validate popup functionality, API calls, tab opening, and error handling
- [x] Prepare extension for publishing
  - [x] Add extension icons and assets
  - [x] Write installation and usage documentation

### Stage 7: AI Analyzer & Integration

**Duration:** 2 weeks
**Dependencies:** Backend API and Chrome Extension (Stages 1–6) must be functional

#### Sub-steps
- [x] Set up Python FastAPI project for AI analyzer
  - [x] Initialize FastAPI app and project structure
  - [x] Set up Python virtual environment and requirements.txt
  - [x] Add Dockerfile for containerization
- [x] Build feature extractor for web page analysis
  - [x] Integrate Playwright or BeautifulSoup for DOM/text/metadata extraction
  - [x] Implement URL, form, script, and outbound link parsing
- [ ] Integrate DistilBERT/TinyBERT model (HuggingFace)
  - [ ] Download or train finetuned model for link classification
  - [ ] Load model in FastAPI app
  - [ ] Implement inference endpoint
- [ ] Implement `POST /analyze` endpoint
  - [ ] Accept JSON input (text, metadata, URL)
  - [ ] Return trust score, category, and risk flags
- [ ] Add risk flag rules
  - [ ] Implement regex and form detection for phishing/spam indicators
- [ ] Containerize AI analyzer service
  - [ ] Build and test Docker image
  - [ ] Expose service on internal network for backend access
- [ ] Integrate backend with AI analyzer
  - [ ] Implement backend service to send DOM/text to AI analyzer
  - [ ] Handle async analysis requests and polling
  - [ ] Store and retrieve analysis results by session ID
- [ ] Implement error handling and logging
  - [ ] Log all analysis requests, errors, and model outputs
  - [ ] Add error responses for invalid input or model failures
- [ ] Test AI analyzer and integration
  - [ ] Write unit tests for FastAPI endpoints
  - [ ] Write integration tests for backend-to-AI communication
  - [ ] Validate trust score and risk flag outputs
- [ ] Document AI analyzer API and integration steps
  - [ ] Write usage and deployment guide
  - [ ] Document model training and update process

### Stage 8: Disposable Desktop Service (Complete)

**Duration:** 1 week
**Dependencies:** Backend API and Chrome Extension (Stages 1–6) must be functional

#### Sub-steps
- [x] User Flow & Requirements
  - [x] Define user requirements for disposable desktop (supported Linux flavors, VNC access, session controls)
  - [x] Design user flow for desktop session creation, access, and termination
- [x] Container Image Selection & Setup
  - [x] Allow user to choose Linux flavor: debian, ubuntu, fedora, kali, arch
  - [x] Use official images from linuxserver.io for built-in VNC support
  - [x] Evaluate and document options (e.g., linuxserver/webtop)
- [x] Docker Compose & Traefik Integration
  - [x] Add service definition for each supported flavor
  - [x] Configure Traefik labels for dynamic subdomain routing
- [x] Backend API Implementation
  - [x] Implement `POST /api/desktop/spawn` (launch desktop container)
  - [x] Implement `POST /api/desktop/stop` (terminate container)
  - [x] Implement `POST /api/desktop/extend` (update TTL)
  - [x] Implement `GET /api/desktop/status/:sessionId` (container health)
- [x] Session Management
  - [x] Generate unique session IDs and tokens
  - [x] Implement container TTL manager for desktop sessions
  - [x] Auto-kill expired desktop containers
- [x] Security & Resource Controls
  - [x] Isolate containers, restrict network access, enforce resource limits
  - [x] Validate user access to sessions
- [x] Testing & Validation
  - [x] Validate session creation, VNC access, subdomain routing, and auto-expiry
  - [x] Write unit and integration tests for API endpoints
- [x] Documentation
  - [x] Document usage, deployment, and security considerations

### Stage 9: Disposable File Viewer/Reader Service

**Duration:** 1 week
**Dependencies:** Backend API and Chrome Extension (Stages 1–6) must be functional

#### Sub-steps
- [ ] User Flow & Requirements
  - [ ] Define user requirements for disposable file viewing (supported file types, upload flow, session controls)
  - [ ] Design user flow for file upload, viewing, and session termination
- [ ] Container Image Selection & Setup
  - [ ] Allow user to choose Linux flavor: debian, ubuntu, fedora, kali, arch
  - [ ] Use official images from linuxserver.io for built-in VNC support
  - [ ] Evaluate and document options (e.g., containerized LibreOffice, PDF.js)
- [ ] Docker Compose & Traefik Integration
  - [ ] Add service definition for each supported flavor
  - [ ] Configure Traefik labels for dynamic subdomain routing
- [ ] Backend API Implementation
  - [ ] Implement `POST /api/file/spawn` (launch file viewer container)
  - [ ] Implement `POST /api/file/stop` (terminate container)
  - [ ] Implement `POST /api/file/extend` (update TTL)
  - [ ] Implement `GET /api/file/status/:sessionId` (container health)
- [ ] File Upload & Access Flow
  - [ ] Accept file uploads via API or signed URL
  - [ ] Mount/upload files to disposable container securely
  - [ ] Validate file type and size
- [ ] Session Management
  - [ ] Generate unique session IDs and tokens
  - [ ] Implement container TTL manager for file viewer sessions
  - [ ] Auto-kill expired file viewer containers
- [ ] Security & Resource Controls
  - [ ] Isolate containers, restrict file access, enforce resource limits
  - [ ] Validate user access to sessions and files
- [ ] Testing & Validation
  - [ ] Validate file upload, viewing, subdomain routing, and auto-expiry
  - [ ] Write unit and integration tests for API endpoints
- [ ] Documentation
  - [ ] Document usage, deployment, and security considerations

### Stage 10: Frontend Dashboard (React/Next.js) (Complete)

**Duration:** 2 weeks
**Dependencies:** Backend, Chrome Extension, AI Analyzer, Disposable Desktop, and File Viewer services must be functional

#### Sub-steps
- [x] Project Setup
  - [x] Initialize frontend project with Next.js (TypeScript recommended)
  - [x] Set up folder structure (components, pages, hooks, utils, styles)
  - [x] Configure environment variables for API endpoints
- [x] UI/UX Implementation
  - [x] Design and implement responsive dashboard layout
  - [x] Build session list view (browser, desktop, file viewer sessions)
  - [x] Build session detail view (status, controls, analysis results)
  - [x] Implement navigation and routing
  - [x] Add loading, error, and empty states
- [x] API Integration
  - [x] Integrate with backend APIs for session management (spawn, stop, extend, status)
  - [x] Integrate with AI analyzer API for analysis results
  - [x] Integrate with file upload endpoints for file viewer
- [x] Session Management & Controls
  - [x] Implement stop/extend controls for all session types
  - [x] Display session expiry, health, and status
- [x] Analysis Results Display
  - [x] Show trust score, risk flags, and summary for each session
  - [x] Visualize analysis history and trends (optional)
- [x] Security & Access Control
  - [x] Implement authentication (optional, e.g., JWT)
  - [x] Enforce CORS and secure API usage
- [x] Testing & Validation
  - [x] Write unit and integration tests for components and API hooks
  - [x] Conduct end-to-end testing of user flows
- [x] Deployment & Documentation
  - [x] Prepare for deployment (Vercel, Netlify, or Docker)
  - [x] Write user and developer documentation

## Current Implementation Status

### ✅ Completed Features

**Stage 1: Foundation & Setup (Complete)**
- [x] Node.js development environment setup
- [x] Backend project structure with proper folder organization
- [x] Docker Compose configuration with Traefik and Chromium
- [x] Environment variables and secrets management
- [x] Basic Express server setup with middleware
- [x] MongoDB database connection
- [x] Authentication system (sign up, sign in, sign out)
- [x] User model with role-based access control
- [x] Error handling middleware
- [x] CORS configuration
- [x] Request logging with Morgan
- [x] Winston logging implementation with file and console transports

**Stage 2: Core Backend Features (Complete)**
- [x] Complete Docker integration for browser session management
- [x] Implement session ID generation and management with UUID
- [x] Add Traefik label integration for dynamic routing
- [x] Implement container TTL manager with background cleanup service
- [x] Add browser session status endpoint
- [x] Implement all browser session endpoints (start, stop, extend, status, list, cleanup)
- [x] Session management with automatic expiry and cleanup
- [x] Comprehensive error handling and logging for all Docker operations
- [x] **NEW: Accurate remaining time endpoint (`/remaining_time`)**
- [x] **NEW: Enhanced auto-cleanup with immediate container stopping**

**Stage 4: Polish, Security & Optimization (Complete)**
- [x] Container resource limits implementation (2GB memory, 50% CPU, ulimits)
- [x] Health check endpoint with comprehensive system monitoring
- [x] Complete testing infrastructure with Jest framework
- [x] Unit tests for authentication, Docker services, and health endpoints
- [x] Integration tests for browser session management and user flows
- [x] Performance testing and profiling for container operations
- [x] Docker and Traefik performance optimizations
- [x] Production deployment guide with security hardening
- [x] Comprehensive environment variable documentation
- [x] Enhanced error tracking and bug documentation

**Stage 6: Chrome Extension Development (Complete)**
- [x] Chrome extension project structure with TypeScript and Webpack
- [x] Manifest V3 configuration with proper permissions
- [x] Comprehensive popup UI for all three services (browser, desktop, viewer)
- [x] Background service worker with session management
- [x] Optimized API client with axios and functional approach
- [x] Proper backend API endpoint alignment (no API key required)
- [x] Session timer and status monitoring functionality
- [x] File viewer upload interface with drag-and-drop
- [x] Theme switching (light/dark mode) support
- [x] Enhanced error handling with axios
- [x] Chrome storage integration for session persistence
- [x] **NEW: Right-click context menu integration with URL navigation**
- [x] Extension icons and assets (using icon1.png)
- [x] Enhanced popup UI with optimized size and compact design
- [x] Backend API integration with correct endpoint mapping
- [x] Container startup delay and double-click prevention
- [x] Session state persistence and UI stability improvements
- [x] Enhanced status polling with change detection and debugging
- [x] **NEW: Bidirectional tab-session management (tab close → stop container, stop session → close tab)**
- [x] **NEW: Immediate container cleanup on timer expiration**
- [x] **NEW: Accurate timer synchronization with backend remaining time endpoint**
- [x] **NEW: Automatic tab closure when sessions expire or are stopped**

**Stage 8: Disposable Desktop Service (Complete)**
- [x] Desktop container orchestration with VNC support
- [x] Multiple Linux flavor support (ubuntu, debian, fedora, alpine, arch)
- [x] Desktop session management API with all endpoints
- [x] Traefik integration for dynamic subdomain routing
- [x] Auto-cleanup and session expiry management
- [x] Security and resource controls
- [x] Comprehensive error handling and logging

**Stage 10: Frontend Dashboard (React/Next.js) (Complete)**
- [x] Next.js project setup with TypeScript and Tailwind CSS
- [x] Complete UI component library using shadcn/ui
- [x] Responsive landing page with hero, features, and download sections
- [x] Admin/user dashboard with session management interface
- [x] Services page with container management controls
- [x] User profile page with settings and activity tracking
- [x] Navigation system with theme toggle (dark/light mode)
- [x] Session management with start/stop/extend controls
- [x] Real-time session status and timer display
- [x] Modern design system with custom styling and animations
- [x] Mobile-responsive layout and components
- [x] Integration-ready API endpoints for backend communication

### 🔄 In Progress

Currently no active development tasks.

### ⏳ Pending

**Stage 7: AI Analyzer & Integration**
- [ ] Set up Python FastAPI project for AI analyzer
- [ ] Build feature extractor for web page analysis
- [ ] Integrate machine learning models for link classification
- [ ] Implement analysis endpoints and backend integration

**Stage 8: Disposable Desktop Service (Complete)**
- [x] Desktop container orchestration with VNC support
- [x] Multiple Linux flavor support (ubuntu, debian, fedora, alpine, arch)
- [x] Desktop session management API with all endpoints
- [x] Traefik integration for dynamic subdomain routing
- [x] Auto-cleanup and session expiry management
- [x] Security and resource controls
- [x] Comprehensive error handling and logging

**Stage 9: Disposable File Viewer/Reader Service**
- [ ] File upload and container mounting
- [ ] File viewer container implementations
- [ ] Secure file access controls

**Stage 10: Frontend Dashboard (React/Next.js) (Complete)**
- [x] Dashboard UI implementation
- [x] Session management interface
- [x] Analysis results visualization

## Resource Links

- [Express.js Documentation](https://expressjs.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [DuckDNS](https://www.duckdns.org/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [HuggingFace Transformers](https://huggingface.co/docs/transformers/index)
- [Winston Logger](https://github.com/winstonjs/winston)
- [Grafana Loki](https://grafana.com/oss/loki/)
- [MongoDB Docs](https://www.mongodb.com/docs/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Best Practices: Docker Security](https://docs.docker.com/engine/security/security/)
- [Best Practices: Node.js Production](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [linuxserver.io Docker Images](https://www.linuxserver.io/)
- [React Documentation](https://react.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
