import { cleanupExpiredSessions } from './docker.js';
import { cleanupExpiredDesktopSessions } from './desktop.js';
import logger from '../utils/logger.js';

class SessionManager {
  constructor() {
    this.cleanupInterval = null;
    this.isRunning = false;
  }

  /**
   * Start the session manager
   * @param {number} intervalMinutes - Cleanup interval in minutes (default: 1 for more responsive cleanup)
   */
  start(intervalMinutes = 1) {
    if (this.isRunning) {
      logger.warn('Session manager is already running');
      return;
    }

    logger.info(`Starting session manager with ${intervalMinutes} minute cleanup interval`);
    
    this.isRunning = true;
    this.cleanupInterval = setInterval(async () => {
      try {
        // Clean up both browser and desktop sessions
        const browserCleanedCount = await cleanupExpiredSessions();
        const desktopCleanedCount = await cleanupExpiredDesktopSessions();
        
        const totalCleaned = browserCleanedCount + desktopCleanedCount;
        if (totalCleaned > 0) {
          logger.info(`Session manager cleaned up ${totalCleaned} expired sessions (${browserCleanedCount} browser, ${desktopCleanedCount} desktop)`);
        }
      } catch (error) {
        logger.error('Session manager cleanup failed:', error.message);
      }
    }, intervalMinutes * 60 * 1000);

    // Run initial cleanup
    this.performCleanup();
  }

  /**
   * Stop the session manager
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Session manager is not running');
      return;
    }

    logger.info('Stopping session manager');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.isRunning = false;
  }

  /**
   * Perform immediate cleanup
   */
  async performCleanup() {
    try {
      // Clean up both browser and desktop sessions
      const browserCleanedCount = await cleanupExpiredSessions();
      const desktopCleanedCount = await cleanupExpiredDesktopSessions();
      
      const totalCleaned = browserCleanedCount + desktopCleanedCount;
      if (totalCleaned > 0) {
        logger.info(`Manual cleanup completed: ${totalCleaned} sessions cleaned (${browserCleanedCount} browser, ${desktopCleanedCount} desktop)`);
      }
      return totalCleaned;
    } catch (error) {
      logger.error('Manual cleanup failed:', error.message);
      throw error;
    }
  }

  /**
   * Get session manager status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.cleanupInterval !== null
    };
  }
}

// Create singleton instance
const sessionManager = new SessionManager();

export default sessionManager;