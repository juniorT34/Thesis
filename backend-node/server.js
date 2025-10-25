import express from 'express';
import { PORT,MORGAN_MODE } from './config/env.js';
import errorMiddleware from "./middlewares/error.middleware.js"
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import cors from 'cors';
import connectToDatabase from './database/mongodb.js';
import authRouter from './routes/auth.routes.js';
import browserRouter from './routes/browser.routes.js';
import desktopRouter from './routes/desktop.routes.js';
import logger from './utils/logger.js';
import sessionManager from './services/sessionManager.js';

const app = express();
//cors origin to change later for production
app.use(cors());
//logging
app.use(morgan(MORGAN_MODE === 'prod' ? 'combined' : 'dev'))

// always return json
app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(cookieParser());

// arcjet middleware

//endpoints

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/browser', browserRouter)
app.use('/api/v1/desktop', desktopRouter)
app.use('/api/v1/file', () =>{})
app.use('/api/v1/admin', () =>{})

// Health check endpoint
app.get('/api/v1/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'safebox-backend',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
        external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100
      },
      environment: process.env.NODE_ENV || 'development',
      sessionManager: sessionManager.getStatus(),
      database: 'connected' // Will be updated after DB connection check
    };

    // Check database connection
    try {
      const mongoose = await import('mongoose');
      if (mongoose.default.connection.readyState === 1) {
        healthStatus.database = 'connected';
      } else {
        healthStatus.database = 'disconnected';
        healthStatus.status = 'degraded';
      }
    } catch (err) {
      healthStatus.database = 'error';
      healthStatus.status = 'degraded';
    }

    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error.message);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'safebox-backend',
      error: error.message
    });
  }
});

//error middleware
app.use(errorMiddleware)

app.get('/', (req, res) =>{
    res.send("Welcome to the disposable services API")
})

app.listen(PORT, async() =>{
    logger.info(`Server running at http://localhost:${PORT}`)

    //connect to database
    try {
        await connectToDatabase()
        logger.info('Database connected successfully')
        
        // Start session manager for automatic cleanup
        sessionManager.start(1); // Cleanup every 1 minute (increased frequency for 5-min sessions)
        logger.info('Session manager started successfully with 1-minute cleanup interval')
        
    } catch (error) {
        logger.error('Database connection failed:', error.message)
        process.exit(1)
    }
})

export default app;
