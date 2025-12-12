# securelink analyzer Frontend

This is a [Next.js](https://nextjs.org) project for the securelink analyzer disposable container services frontend.

## Getting Started

### Prerequisites

1. **Backend Server**: Make sure the backend is running on port 3001
   ```bash
   cd backend
   npm run dev
   ```

2. **Environment Setup**: Configure the API connection
   ```bash
   # Run the setup script
   chmod +x setup-env.sh
   ./setup-env.sh
   
   # Or manually create .env.local file
   echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1" > .env.local
   ```

### Development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

### ✅ Implemented
- **Services Page**: Real-time container management
  - Browser container start/stop/extend
  - Desktop container start/stop/extend
  - Session status monitoring
  - Automatic session cleanup
  - URL opening for running sessions

- **Dashboard**: Admin and user dashboards
  - Real-time session monitoring
  - System health status
  - Session statistics
  - Auto-refresh every 30 seconds
  - Manual refresh capability

- **API Integration**: Full backend connectivity
  - Centralized API client
  - Error handling with toast notifications
  - Loading states
  - TypeScript interfaces

### 🔄 In Progress
- File viewer service integration
- User authentication
- Advanced analytics

### 📋 Planned
- AI analyzer integration
- Real-time notifications
- Advanced monitoring

## Project Structure

```
frontend/
├── app/                    # Next.js app directory
│   ├── dashboard/         # Dashboard pages
│   ├── services/          # Services management
│   └── profile/           # User profile
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components (shadcn/ui)
│   └── ...               # Feature-specific components
├── hooks/                # Custom React hooks
│   └── useApi.ts         # API state management
├── lib/                  # Utility libraries
│   ├── api.ts           # API client
│   └── utils.ts         # General utilities
└── public/              # Static assets
```

## API Integration

The frontend connects to the backend API for:

- **Session Management**: Start, stop, extend browser and desktop sessions
- **Health Monitoring**: System status and performance metrics
- **Real-time Updates**: Live session status and statistics

See `API_CONFIG.md` for detailed configuration information.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
