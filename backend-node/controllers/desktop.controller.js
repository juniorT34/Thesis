import { 
  launchDesktopContainer, 
  stopDesktopContainer, 
  extendDesktopSession as extendDesktopSessionService, 
  getDesktopContainerStatus,
  generateDesktopSessionId,
  getActiveDesktopSessions,
  cleanupExpiredDesktopSessions
} from "../services/desktop.js"
import logger from "../utils/logger.js"

export const startDesktopSession = async(req, res, next) =>{
  try {
    const { flavor = 'ubuntu' } = req.body;
    // Use a default userId for now since authentication is disabled
    const userId = req.user?.id || 'default-user-id';
    
    logger.info('Desktop session start requested', { userId, flavor });
    
    // Validate flavor
    const supportedFlavors = ['ubuntu', 'debian', 'fedora', 'alpine', 'arch'];
    if (!supportedFlavors.includes(flavor)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported flavor: ${flavor}. Supported flavors: ${supportedFlavors.join(', ')}`
      });
    }
    
    // Generate unique session ID
    const sessionId = generateDesktopSessionId();
    
    // Launch desktop container
    const result = await launchDesktopContainer(sessionId, flavor, userId);
    
    logger.info('Desktop session started successfully', { 
      sessionId, 
      userId, 
      flavor,
      desktopUrl: result.desktopUrl
    });
    
    res.status(201).json({
      success: true,
      message: 'Desktop session started successfully',
      data: result
    });
    
  } catch (error) {
    logger.error(`Failed to start desktop session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to start desktop session',
      error: error.message
    });
  }
}

export const stopDesktopSession = async (req, res, next) =>{
  try {
    const { sessionId } = req.body;
    // Use a default userId for now since authentication is disabled
    const userId = req.user?.id || 'default-user-id';
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    logger.info('Desktop session stop requested', { sessionId, userId });
    
    // Stop desktop container
    const result = await stopDesktopContainer(sessionId, userId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or you do not have permission to stop this session'
      });
    }
    
    logger.info('Desktop session stopped successfully', { sessionId, userId });
    
    res.status(200).json({
      success: true,
      message: 'Desktop session stopped successfully',
      data: { sessionId, status: 'stopped' }
    });
    
  } catch (error) {
    logger.error(`Failed to stop desktop session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to stop desktop session',
      error: error.message
    });
  }
}

export const extendDesktopSession = async(req, res, next) =>{
  try {
    const { sessionId, additionalSeconds = 300 } = req.body; // Default 5 minutes in seconds to match UI
    // Use a default userId for now since authentication is disabled
    const userId = req.user?.id || 'default-user-id';
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    logger.info('Desktop session extend requested', { sessionId, userId, additionalSeconds });
    
    // Extend session
    const result = await extendDesktopSessionService(sessionId, additionalSeconds, userId);
    
    logger.info('Desktop session extended successfully', { sessionId, userId, expiresAt: result.expiresAt });
    
    res.status(200).json({
      success: true,
      message: 'Desktop session extended successfully',
      data: result
    });
    
  } catch (error) {
    logger.error(`Failed to extend desktop session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to extend desktop session',
      error: error.message
    });
  }
}

export const getDesktopSessionStatus = async(req, res, next) =>{
  try {
    const { sessionId } = req.params;
    // Use a default userId for now since authentication is disabled
    const userId = req.user?.id || 'default-user-id';
    
    logger.info('Desktop session status requested', { sessionId, userId });
    
    // Get container status
    const status = await getDesktopContainerStatus(sessionId, userId);
    
    if (status.status === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Session not found or you do not have permission to view this session'
      });
    }
    
    logger.info('Desktop session status retrieved', { sessionId, userId, status: status.status });
    
    res.status(200).json({
      success: true,
      message: 'Desktop session status retrieved successfully',
      data: status
    });
    
  } catch (error) {
    logger.error(`Failed to get desktop session status: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get desktop session status',
      error: error.message
    });
  }
}

export const getAllActiveDesktopSessions = async(req, res, next) =>{
  try {
    // Use a default userId for now since authentication is disabled
    const userId = req.user?.id || 'default-user-id';
    
    logger.info('Active desktop sessions requested', { userId });
    
    // Get all active desktop sessions for this user
    const sessions = getActiveDesktopSessions(userId);
    
    logger.info(`Retrieved ${sessions.length} active desktop sessions for user ${userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Active desktop sessions retrieved successfully',
      data: {
        count: sessions.length,
        sessions
      }
    });
    
  } catch (error) {
    logger.error(`Failed to get active desktop sessions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get active desktop sessions',
      error: error.message
    });
  }
}

export const cleanupDesktopSessions = async(req, res, next) =>{
  try {
    // Use a default userId for now since authentication is disabled
    const userId = req.user?.id || 'default-user-id';
    
    logger.info('Desktop sessions cleanup requested', { userId });
    
    // Cleanup expired desktop sessions
    const result = await cleanupExpiredDesktopSessions();
    
    logger.info('Desktop sessions cleanup completed', { userId, cleanedSessions: result });
    
    res.status(200).json({
      success: true,
      message: 'Desktop sessions cleanup completed successfully',
      data: {
        cleanedSessions: result
      }
    });
    
  } catch (error) {
    logger.error(`Failed to cleanup desktop sessions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup desktop sessions',
      error: error.message
    });
  }
}

export const getDesktopRemainingTime = async(req, res, next) => {
  try {
    const { sessionId } = req.params;
    // Use a default userId for now since authentication is disabled
    const userId = req.user?.id || 'default-user-id';
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    logger.info('Getting remaining time for desktop session', { sessionId, userId });
    
    // Get session info from active sessions
    const sessionInfo = await getDesktopContainerStatus(sessionId, userId);
    
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
    
    logger.info('Desktop remaining time calculated', { 
      sessionId, 
      userId, 
      remainingSeconds, 
      expiresAt: sessionInfo.expiresAt 
    });
    
    res.status(200).json({
      success: true,
      message: 'Desktop remaining time retrieved successfully',
      data: {
        sessionId,
        remainingSeconds,
        expiresAt: sessionInfo.expiresAt,
        isExpired: remainingSeconds <= 0
      }
    });
    
  } catch (error) {
    logger.error(`Failed to get remaining time for desktop session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get remaining time',
      error: error.message
    });
  }
}
