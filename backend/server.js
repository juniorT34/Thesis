import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import { PORT, MORGAN_MODE, NODE_ENV } from './config/env.js';
import errorMiddleware from './middlewares/error.middleware.js';
import { initializeDatabase, query as dbQuery } from './database/postgres.js';
import authRouter from './routes/auth.routes.js';
import browserRouter from './routes/browser.routes.js';
import desktopRouter from './routes/desktop.routes.js';
import adminRouter from './routes/admin.routes.js';
import sessionRouter from './routes/session.routes.js';
import authorize from './middlewares/auth.middleware.js';
import { streamSessionEvents } from './controllers/session.controller.js';
import logger from './utils/logger.js';
import sessionManager from './services/sessionManager.js';
import { seedDefaultAdmin } from './utils/adminSeeder.js';

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(morgan(MORGAN_MODE === 'prod' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;

const buildMemorySnapshot = () => {
  const usage = process.memoryUsage();
  return {
    heapUsedMb: mb(usage.heapUsed),
    heapTotalMb: mb(usage.heapTotal),
    externalMb: mb(usage.external),
    rssMb: mb(usage.rss),
  };
};

const withDbStatus = async (payload) => {
  try {
    const start = Date.now();
    await dbQuery('SELECT 1');
    return {
      ...payload,
      database: {
        status: 'connected',
        queryTimeMs: Date.now() - start,
      },
    };
  } catch (err) {
    return {
      ...payload,
      status: payload.status === 'healthy' ? 'degraded' : payload.status,
      database: {
        status: 'error',
        error: err.message,
      },
    };
  }
};

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/browser', browserRouter);
app.use('/api/v1/desktop', desktopRouter);
app.get('/api/v1/sessions/events', authorize, streamSessionEvents);
app.use('/api/v1/sessions', sessionRouter);
app.use('/api/v1/admin', adminRouter);

app.get('/api/v1/health', async (req, res) => {
  try {
    const baseStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'secureLink-backend',
      version: process.env.npm_package_version || '1.0.0',
      uptimeSeconds: Math.round(process.uptime()),
      memory: buildMemorySnapshot(),
      environment: process.env.NODE_ENV || 'development',
      sessionManager: sessionManager.getStatus(),
    };

    const healthStatus = await withDbStatus(baseStatus);
    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error.message);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'secureLink-backend',
      error: error.message,
    });
  }
});

app.get('/api/v1/metrics', async (req, res) => {
  try {
    const sessionStatus = sessionManager.getStatus();
    const activeBrowser = sessionStatus.activeBrowserSessions || 0;
    const activeDesktop = sessionStatus.activeDesktopSessions || 0;
    const totalBrowser = sessionStatus.totalBrowserSessions || 0;
    const totalDesktop = sessionStatus.totalDesktopSessions || 0;

    const baseMetrics = {
      service: 'secureLink-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      performance: {
        activeSessions: {
          browser: activeBrowser,
          desktop: activeDesktop,
          total: activeBrowser + activeDesktop,
        },
        totalSessions: {
          browser: totalBrowser,
          desktop: totalDesktop,
          total: totalBrowser + totalDesktop,
        },
      },
      system: {
        memory: buildMemorySnapshot(),
      },
      environment: process.env.NODE_ENV || 'development',
    };

    const metrics = await withDbStatus(baseMetrics);
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('Metrics endpoint failed:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message,
    });
  }
});

app.use(errorMiddleware);

app.get('/', (req, res) => {
  res.send('Welcome to the disposable services API');
});

export const startServer = async () => {
  try {
    await initializeDatabase();
    await seedDefaultAdmin();

    if (NODE_ENV !== 'test') {
      sessionManager.start(1);
      logger.info('Session manager started successfully with 1-minute cleanup interval');
    }

    return app.listen(PORT, () => {
      logger.info(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

if (NODE_ENV !== 'test') {
  startServer();
}

export default app;
