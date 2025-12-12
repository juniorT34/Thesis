# Complete Setup Guide

## Project Description

This a microservice application, for the secureLink Analyzer project(thesis)
This application featuring:
- **Backend**: Node.js Express server with PostgreSQL database, authentication, session management, and Docker support
- **Frontend**: Next.js React application with TypeScript for the user interface and dashboard
- **Extension**: Chrome extension for browser integration
- **ML Service**: Python-based machine learning service with BERT for advanced AI capabilities

The project uses Docker for containerization, PostgreSQL for data persistence, and includes admin functionality for user and session management.

---

## System Requirements

Before you begin, ensure you have the following installed:

- **Git**: Version control
- **Node.js**: v18+ (for backend and frontend)
- **npm**: v9+ (package manager)
- **Python**: v3.8+ (for ML service)
- **Docker**: Latest stable version (required for backend and PostgreSQL)
- **Docker Compose**: Latest stable version
- **PostgreSQL**: (runs in Docker, so manual installation not required)

---

## Project Structure

```
Thesis/
├── backend/          # Express.js server
├── frontend/         # Next.js application
├── extension/        # Chrome extension
└── ML/              # Python ML service
```

---

## Installation & Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/juniorT34/Thesis.git
cd ./Thesis
```

---

### Step 2: Backend Setup

The backend requires Docker to run PostgreSQL and the Node.js application.

#### Prerequisites
- Docker must be running on your system
- Postgres database setup(note that it can run without the database but mandatory for the frontend and extension part)

#### Environment Configuration

Create a `.env.development.local` file in the `backend/` directory:

```bash
cd backend
```

Create `.env.development.local`:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:password@postgres:5432/db_name

# Server Configuration
PORT=4000
NODE_ENV=development

# Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
# container setup 
MORGAN_MODE='dev'
CHROMIUM_BROWSER="lscr.io/linuxserver/chromium:latest"

UBUNTU_DESKTOP="junior039/ubuntu-desktop-mate"
DEBIAN_DESKTOP="junior039/debian-desktop-kde"
FEDORA_DESKTOP="junior039/fedora-desktop-mate"
ALPINE_DESKTOP="junior039/alpine-desktop"
ARCH_DESKTOP="junior039/arch-desktop-openbox"



# Arcjet Configuration (optional)
ARCJET_KEY=your-arcjet-key-here

# Admin Configuration
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin-password-here
```

#### Docker Setup & Running Backend

```bash
# From the backend directory
docker-compose up -d
```

This will:

- Start the Express server on `http://localhost:4000`

To view backend logs:

```bash
docker-compose logs -f
```

To stop the backend:

```bash
docker-compose down
```

### Health Check

- `GET /api/v1/health` - System health status

### Browser Sessions

- `POST /api/v1/browser/start` - Start browser session
- `POST /api/v1/browser/stop` - Stop browser session
- `POST /api/v1/browser/extend` - Extend browser session
- `GET /api/v1/browser/status/:sessionId` - Get session status
- `GET /api/v1/browser/remaining_time/:sessionId` - Get remaining time
- `GET /api/v1/browser/sessions` - Get all browser sessions

### Desktop Sessions

- `POST /api/v1/desktop/start` - Start desktop session
- `POST /api/v1/desktop/stop` - Stop desktop session
- `POST /api/v1/desktop/extend` - Extend desktop session
- `GET /api/v1/desktop/status/:sessionId` - Get session status
- `GET /api/v1/desktop/remaining_time/:sessionId` - Get remaining time
- `GET /api/v1/desktop/sessions` - Get all desktop sessions

---

### Step 3: Frontend Setup

The frontend requires Node.js and npm. It communicates with the backend API and PostgreSQL database.

#### Installation

```bash
cd ../frontend
npm install
```

#### Environment Configuration

Create a `.env.local` file in the `frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
DATABASE_URL="DATABASE_URL=postgresql://postgres:junior@localhost:5432/db_name"
NODE_ENV=development
#note that the secret has to be match with backend
JWT_SECRET="secret-here"
JWT_EXPIRES_IN="1d"
DEFAULT_ADMIN_EMAIL="admin@example.com"
DEFAULT_ADMIN_PASSWORD="admin-password"
DEFAULT_ADMIN_NAME="admin"
```

#### Running the Frontend

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

To build for production:

```bash
npm run build
npm start
```

---

### Step 4: Extension Setup

The extension requires Node.js and npm. It integrates with the backend API for authentication.

#### Installation

```bash
cd ../extension
npm install
```

#### Environment Configuration

Create a `.env` file in the `extension/` directory:

```env
# Backend API Configuration
API_KEY='6pcGYMLvjXCXhkk4XQCFY5iDd8DHNIskatAnsKT1Qfc='
```

#### Building with Webpack

```bash
# Development build (watch mode)
npm run dev

# Production build
npm run build
```

#### Loading Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Navigate to the `extension/` folder and select it
5. The extension will appear in your Chrome toolbar
6. load the dist folder

---

### Step 5: ML Service Setup

The ML service provides machine learning capabilities using Python and BERT.

#### Installation

```bash
cd ../ML
pip install -r requirements.txt
```

#### Running the ML Service

Start the ML service with Uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

The ML API will be available at `http://localhost:8001`

Access the API documentation:
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

---

## Complete Startup Guide

You need some space to download the machine learning model for inference and the container image
as they will be downloaded automatically if they are not installed on first startup of the program
To run the entire project locally, follow these steps in order:

### Terminal 1: Backend & Database

```bash
cd backend
docker-compose up -d
# Wait for containers to be ready (check with: docker-compose logs)
```

### Terminal 2: Frontend

```bash
cd frontend
npm install  # (if not already done)
npm run dev
# Frontend runs on http://localhost:3000
```

### Terminal 3: Extension (Optional)

```bash
cd extension
npm install  # (if not already done)
npm run dev
# Watch for changes and build webpack
```

### Terminal 4: ML Service

```bash
cd ML
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
# ML API runs on http://localhost:8001
```

---

## Verification Checklist

- [ ] Docker is running
- [ ] Backend is running: `http://localhost:4000`
- [ ] Frontend is running: `http://localhost:3000`
- [ ] PostgreSQL is accessible from the backend
- [ ] ML Service is running: `http://localhost:8001`
- [ ] Extension is loaded in Chrome (if needed)
- [ ] `.env.development.local` exists in `backend/`
- [ ] `.env.local` exists in `frontend/`
- [ ] `.env` exists in `extension/` (if extension is used)

---






## Development Workflow

1. Make code changes in your preferred editor
2. Frontend & Extension: Changes auto-reload with hot module replacement
3. Backend: Restart Docker container if needed: `docker-compose restart`
4. ML Service: Uvicorn auto-reloads on file changes
5. Test in the browser and API endpoints

---

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Python Uvicorn](https://www.uvicorn.org/)

---

## Support

For issues or questions, please refer to the specific service documentation or check the logs in each terminal window.
