# Project Structure

## Root Directory

safebox/
├── backend/                # Node.js API for browser orchestration
│   ├── controllers/        # API route handlers (browser, auth, admin)
│   ├── routes/             # Express route definitions
│   ├── services/           # Docker, Traefik, session logic
│   ├── middlewares/        # Auth, error, logging, CORS
│   ├── models/             # (Optional) DB models (sessions, users)
│   ├── utils/              # Helper functions, error classes
│   ├── config/             # Environment, Docker, Traefik configs
│   ├── database/           # (Optional) DB connection/init
│   ├── tests/              # Unit/integration tests (Jest/Mocha)
│   ├── Dockerfile          # Backend Docker build
│   ├── docker-compose.yml  # Compose for backend, Chromium, Traefik, AI
│   └── package.json        # Node.js dependencies
├── ai-analyzer/            # Python FastAPI service for link analysis
│   ├── app/                # FastAPI app, endpoints, model loading
│   ├── models/             # ML models, checkpoints
│   ├── scripts/            # Training, data prep scripts
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # AI analyzer Docker build
│   └── tests/              # Unit/integration tests (pytest)
├── extension/              # Chrome extension (JS, manifest, assets)
│   ├── src/                # Extension source code
│   ├── manifest.json       # Chrome extension manifest v3
│   └── assets/             # Icons, images
├── frontend/               # (Optional) React dashboard
│   ├── src/                # React components, pages, hooks
│   ├── public/             # Static assets
│   ├── package.json        # React dependencies
│   └── tests/              # Frontend tests
├── docker/                 # Infra scripts, Traefik, DuckDNS configs
│   ├── traefik.yml         # Traefik config
│   ├── duckdns.sh          # DuckDNS update script
│   └── letsencrypt/        # TLS cert storage
├── Documentations/         # All project documentation
│   ├── Implementation.md   # Implementation plan
│   ├── Project_structure.md# Project structure (this file)
│   ├── UI_UX_doc.md        # UI/UX guidelines
│   ├── Bug_tracking.md     # Bug/issue log
│   ├── prd.md              # Product requirements
│   ├── breakdown.md        # Task breakdown
│   └── system.md           # System architecture
└── .env.example            # Example environment variables

## Detailed Structure
- **backend/**: Main Node.js API for session orchestration, container management, and API endpoints.
- **ai-analyzer/**: Python FastAPI service for AI link analysis, model inference, and training scripts.
- **extension/**: Chrome extension for right-click integration and SafeBox API calls.
- **frontend/**: (Optional) React dashboard for session management and analytics.
- **docker/**: Infrastructure configs for Traefik, DuckDNS, and TLS.
- **Documentations/**: All project docs, plans, and guides.
- **.env.example**: Template for required environment variables.

## Configuration & Assets
- **Config files**: All service configs in their respective folders (backend/config, docker/traefik.yml, etc.)
- **Assets**: Images, icons, and static files in extension/assets, frontend/public, etc.
- **Documentation**: All docs centralized in Documentations/ for easy access.

## Build & Deployment
- Use `docker-compose.yml` in backend/ for local and production orchestration.
- Traefik and DuckDNS configs in docker/ for secure routing and domain management.
- Each service (backend, ai-analyzer, extension, frontend) is containerized for modular deployment.

## Environment-Specific Configurations
- Use `.env` files for secrets, API keys, and environment-specific settings.
- Example provided in `.env.example` at project root.

## References
- See Implementation.md for staged plan and dependencies.
- See UI_UX_doc.md for design and UX requirements.
- See Bug_tracking.md for error/issue documentation.
