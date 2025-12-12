import { Router } from "express";
import { 
  extendDesktopSession, 
  startDesktopSession, 
  stopDesktopSession,
  getDesktopSessionStatus,
  getAllActiveDesktopSessions,
  cleanupDesktopSessions,
  getDesktopRemainingTime
} from "../controllers/desktop.controller.js";
import { extensionAuthorize } from "../middlewares/auth.middleware.js";

const desktopRouter = Router();

desktopRouter.use(extensionAuthorize);

// Session management endpoints - require authentication
desktopRouter.post('/start', startDesktopSession)
desktopRouter.post('/stop', stopDesktopSession)
desktopRouter.post('/extend', extendDesktopSession)

// Session status and monitoring endpoints - require authentication
desktopRouter.get('/status/:sessionId', getDesktopSessionStatus)
desktopRouter.get('/remaining_time/:sessionId', getDesktopRemainingTime)
desktopRouter.get('/sessions', getAllActiveDesktopSessions)
desktopRouter.post('/cleanup', cleanupDesktopSessions)

export default desktopRouter;
