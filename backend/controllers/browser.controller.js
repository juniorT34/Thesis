import { 
  launchBrowserContainer, 
  stopBrowserContainer, 
  extendSession, 
  getContainerStatus,
  generateSessionId,
  getActiveSessions,
  cleanupExpiredSessions
} from "../services/docker.js"
import logger from "../utils/logger.js"

export const startBrowserSession = async(req, res, next) =>{
  try {
    const { url } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    
    logger.info('Browser session start requested', { userId, url });
    
    // Log the URL being passed to the container
    if (url) {
      logger.info(`Target URL for browser session: ${url}`);
      
      // Validate URL format
      try {
        const urlObj = new URL(url);
        logger.info(`URL validation passed: ${urlObj.toString()}`);
      } catch (error) {
        logger.warn(`Invalid URL format: ${url}, will use default`);
      }
    } else {
      logger.info('No target URL provided, will use default (DuckDuckGo)');
    }
    
    // Generate unique session ID
    const sessionId = generateSessionId();
    
    // Launch browser container
    const result = await launchBrowserContainer(sessionId, url, userId);
    
    logger.info('Browser session started successfully', { 
      sessionId, 
      userId, 
      browserUrl: result.browserUrl,
      targetUrl: url 
    });

    res.status(201).json({
      success: true,
      message: 'Browser session started successfully',
      data: result
    });
    
  } catch (error) {
    logger.error(`Failed to start browser session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to start browser session',
      error: error.message
    });
  }
}

export const stopBrowserSession = async (req, res, next) =>{
  try {
    const { sessionId } = req.body;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    logger.info('Browser session stop requested', { sessionId, userId });
    
    // Stop browser container
    const result = await stopBrowserContainer(sessionId, userId, isAdmin);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or you do not have permission to stop this session'
      });
    }
    
    logger.info('Browser session stopped successfully', { sessionId, userId });

    res.status(200).json({
      success: true,
      message: 'Browser session stopped successfully',
      data: { sessionId, status: 'stopped' }
    });
    
  } catch (error) {
    logger.error(`Failed to stop browser session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to stop browser session',
      error: error.message
    });
  }
}

export const extendBrowserSession = async(req, res, next) =>{
  try {
    const { sessionId, additionalSeconds = 300 } = req.body; // Default 5 minutes in seconds to match UI
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    // Debug logging to see what's being received
    logger.info('Browser session extend requested - DEBUG', { 
      sessionId, 
      userId, 
      additionalSeconds,
      additionalSecondsType: typeof additionalSeconds,
      additionalSecondsValue: req.body.additionalSeconds,
      additionalSecondsParsed: parseInt(req.body.additionalSeconds),
      requestBody: req.body,
      hasAdditionalSeconds: 'additionalSeconds' in req.body
    });
    
    // Ensure additionalSeconds is a number
    let additionalSecondsNum = 300; // Default 5 minutes in seconds to match UI
    if (additionalSeconds !== undefined && additionalSeconds !== null) {
      const parsed = parseInt(additionalSeconds);
      if (!isNaN(parsed)) {
        additionalSecondsNum = parsed;
      }
    }
    
    // Debug: Log the parsed value
    logger.info('Parsed additionalSeconds', { 
      original: additionalSeconds, 
      parsed: additionalSecondsNum, 
      parsedType: typeof additionalSecondsNum 
    });
    
    // Extend session
    const result = await extendSession(sessionId, additionalSecondsNum, userId, isAdmin);
    
    logger.info('Browser session extended successfully', { sessionId, userId, expiresAt: result.expiresAt });

    res.status(200).json({
      success: true,
      message: 'Browser session extended successfully',
      data: result
    });
    
  } catch (error) {
    logger.error(`Failed to extend browser session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to extend browser session',
      error: error.message
    });
  }
}

export const getBrowserSessionStatus = async(req, res, next) =>{
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    
    logger.info('Browser session status requested', { sessionId, userId });
    
    // Get container status
    const status = await getContainerStatus(sessionId, userId);
    
    if (status.status === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Session not found or you do not have permission to view this session'
      });
    }
    
    logger.info('Browser session status retrieved', { sessionId, userId, status: status.status });
    
    res.status(200).json({
      success: true,
      message: 'Browser session status retrieved successfully',
      data: status
    });
    
  } catch (error) {
    logger.error(`Failed to get browser session status: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get browser session status',
      error: error.message
    });
  }
}

export const getAllActiveSessions = async(req, res, next) =>{
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    
    logger.info('Active sessions requested', { userId });
    
    // Get all active sessions for this user
    const sessions = getActiveSessions(userId);
    
    logger.info(`Retrieved ${sessions.length} active sessions for user ${userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Active sessions retrieved successfully',
      data: {
        count: sessions.length,
        sessions
      }
    });
    
  } catch (error) {
    logger.error(`Failed to get active sessions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get active sessions',
      error: error.message
    });
  }
}

export const cleanupSessions = async(req, res, next) =>{
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    
    logger.info('Browser sessions cleanup requested', { userId });
    
    // Cleanup expired sessions
    const result = await cleanupExpiredSessions(userId);
    
    logger.info('Browser sessions cleanup completed', { userId, cleanedSessions: result.length });
    
    res.status(200).json({
      success: true,
      message: 'Browser sessions cleanup completed successfully',
      data: {
        cleanedSessions: result.length,
        sessions: result
      }
    });
    
  } catch (error) {
    logger.error(`Failed to cleanup browser sessions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup browser sessions',
      error: error.message
    });
  }
}

export const getRemainingTime = async(req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    logger.info('Getting remaining time for browser session', { sessionId, userId });
    
    // Get session info from active sessions
    const sessionInfo = await getContainerStatus(sessionId, userId);
    
    if (!sessionInfo || sessionInfo.status === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Session not found or you do not have permission to access this session'
      });
    }
    
    // Calculate remaining time
    const now = Date.now();
    const expiresAt = sessionInfo.expiresAt.getTime();
    const remainingMs = expiresAt - now;
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    
    logger.info('Remaining time calculated', { 
      sessionId, 
      userId, 
      remainingSeconds, 
      expiresAt: sessionInfo.expiresAt 
    });
    
    res.status(200).json({
      success: true,
      message: 'Remaining time retrieved successfully',
      data: {
        sessionId,
        remainingSeconds,
        expiresAt: sessionInfo.expiresAt,
        isExpired: remainingSeconds <= 0
      }
    });
    
  } catch (error) {
    logger.error(`Failed to get remaining time for browser session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get remaining time',
      error: error.message
    });
  }
}