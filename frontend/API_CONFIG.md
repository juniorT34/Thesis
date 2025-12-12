# Frontend API Configuration

## Environment Setup

To connect the frontend to the backend API, you need to set up the following environment variables:

### Create `.env.local` file in the frontend directory:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# Environment
NODE_ENV=development
```

## Backend Requirements

Make sure your backend server is running on port 4000 via Docker Compose. The backend should be started with:

```bash
cd backend
docker-compose up -d
```

## API Endpoints

The frontend is configured to work with the following backend endpoints:

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

## Features Implemented

### Services Page
- Real-time session management for browser and desktop containers
- Start/stop/extend functionality
- Session status monitoring
- Automatic session cleanup
- URL opening for running sessions

### Dashboard
- Real-time session monitoring
- System health status
- Session statistics
- Auto-refresh every 30 seconds
- Manual refresh capability

## Troubleshooting

1. **CORS Issues**: Make sure the backend has CORS enabled
2. **Connection Refused**: Verify the backend is running on port 4000 via Docker Compose
3. **API Errors**: Check the browser console for detailed error messages
4. **Session Not Found**: Sessions may have expired, try refreshing the page

## Development Notes

- The frontend uses React hooks for state management
- API calls are handled through a centralized client
- Error handling includes toast notifications
- Loading states are managed for better UX
- Real-time updates are implemented where possible
