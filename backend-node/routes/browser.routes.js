import { Router } from "express";
import { 
  extendBrowserSession, 
  startBrowserSession, 
  stopBrowserSession,
  getBrowserSessionStatus,
  getAllActiveSessions,
  cleanupSessions,
  getRemainingTime
} from "../controllers/browser.controller.js";
// import authorize from "../middlewares/auth.middleware.js";

const browserRouter = Router();

// Session management endpoints - require authentication
browserRouter.post('/start', startBrowserSession)
browserRouter.post('/stop', stopBrowserSession)
browserRouter.post('/extend', extendBrowserSession)

// Session status and monitoring endpoints - require authentication
browserRouter.get('/status/:sessionId', getBrowserSessionStatus)
browserRouter.get('/remaining_time/:sessionId', getRemainingTime)
browserRouter.get('/sessions', getAllActiveSessions)
browserRouter.post('/cleanup', cleanupSessions)

export default browserRouter;