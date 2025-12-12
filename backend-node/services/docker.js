import Docker from "dockerode"
import logger from "../utils/logger.js"
import { v4 as uuidv4 } from 'uuid'
import { NODE_ENV, CHROMIUM_BROWSER1 } from '../config/env.js'

const docker = new Docker();

// Container configuration based on LinuxServer.io Chromium documentation
const CONTAINER_CONFIG = {
  image: CHROMIUM_BROWSER1,
  env: [
    'PUID=1000',
    'PGID=1000', 
    'TZ=UTC',
    'TITLE=Disposable Browser',
    'CHROME_CLI=https://www.duckduckgo.com',
    'CHROME_OPTS=--no-sandbox --disable-dev-shm-usage --disable-web-security --disable-features=VizDisplayCompositor',
    // Kasm-specific environment variables
    'KASM_URL=https://www.duckduckgo.com',
    'KASM_APP_CONFIG={"url": "https://www.duckduckgo.com"}',
  ],
  exposedPorts: {
    '3000/tcp': {}
  },
  hostConfig: {
    // Dynamic port binding - Docker assigns random host ports
    portBindings: {
      '3000/tcp': [{ hostPort: '', hostIP: '0.0.0.0' }]
    },
    // Shared memory size needed for modern websites - increased for better performance
    shmSize: 3221225472, // 3GB (increased from 2GB)
    // Memory limits - optimized for browser performance
    // memory: 2147483648, // 2GB in bytes (reduced from 3GB for better resource management)
    // memorySwap: 2147483648, // 2GB (same as memory to prevent excessive swap usage)
    // CPU limits - balanced for performance and resource management
    // cpuPeriod: 100000,
    // cpuQuota: 50000, // 50% CPU limit (balanced for multiple concurrent sessions)
    // CPU count limit
    // cpuCount: 2, // Limit to 2 CPU cores maximum
    // Network performance optimization
    networkMode: 'bridge',
    // Security options for GUI compatibility
    securityOpt: ['seccomp=unconfined'],
    // Performance optimizations
    // privileged: false, // Disable privileged mode for security
    // readonlyRootfs: false, // Keep false for browser functionality
    // Auto remove to clean up containers automatically
    autoRemove: true,
    // Restart policy - no restart for disposable containers
    restartPolicy: {
      name: 'no'
    },
    // Additional security: limit device access
    // devices: [],
    // Limit process count to prevent fork bombs
    // ulimits: [
    //   {
    //     name: 'nproc',
    //     soft: 1024,
    //     hard: 2048
    //   },
    //   {
    //     name: 'nofile',
    //     soft: 1024,
    //     hard: 2048
    //   }
    // ]
  },
  labels: {
    'com.disposable-services.type': 'browser-session',
    'com.disposable-services.created-by': 'safebox-api'
  }
};

// Session management
const activeSessions = new Map();

/**
 * Generate a unique session ID
 * @returns {string} Unique session ID
 */
export const generateSessionId = () => {
  // Generate a shorter, more readable ID (8 characters)
  const shortId = uuidv4().replace(/-/g, '').substring(0, 8);
  return `browser-session_${shortId}`;
};

/**
 * Create Traefik labels for dynamic routing
 * @param {string} sessionId - The session ID
 * @returns {Object} Traefik labels object
 */
export const generateTraefikLabels = (sessionId) => {
  // Use localhost for development, DuckDNS for production
  const isDevelopment = NODE_ENV === 'development';
  const domain = isDevelopment ? 'localhost' : 'disposable-services.duckdns.org';
  
  const labels = {
    'traefik.enable': 'true',
    [`traefik.http.routers.browser-${sessionId}.rule`]: `Host(\`${sessionId}.${domain}\`)`,
    [`traefik.http.services.browser-${sessionId}.loadbalancer.server.port`]: '3000',
    'com.disposable-services.session-id': sessionId,
    'com.disposable-services.type': 'browser-session',
    'com.disposable-services.created-by': 'safebox-api'
  };

  if (isDevelopment) {
    // Development: HTTP only
    labels[`traefik.http.routers.browser-${sessionId}.entrypoints`] = 'web';
  } else {
    // Production: HTTPS with Let's Encrypt
    labels[`traefik.http.routers.browser-${sessionId}.entrypoints`] = 'web,websecure';
    labels[`traefik.http.routers.browser-${sessionId}.tls.certresolver`] = 'letsencrypt';
  }

  return labels;
};

/**
 * Launch a new browser container
 * @param {string} sessionId - The session ID
 * @param {string} targetUrl - The URL to navigate to (optional)
 * @param {string} userId - The user ID who owns this session
 * @returns {Promise<Object>} Container info
 */
export const launchBrowserContainer = async (sessionId, targetUrl = null, userId) => {
  try {
    logger.info(`Launching browser container for session: ${sessionId}, user: ${userId}`);
    
    // Generate container name (sessionId already contains browser- prefix)
    const containerName = sessionId;
    
    // Check environment for URL generation
    const isDevelopment = NODE_ENV === 'development';
    
    // Create container configuration
    const containerConfig = {
      ...CONTAINER_CONFIG,
      name: containerName,
      labels: {
        ...CONTAINER_CONFIG.labels,
        ...generateTraefikLabels(sessionId),
        'com.disposable-services.session-id': sessionId,
        'com.disposable-services.user-id': userId
      },
      networkingConfig: {
        endpointsConfig: {
          'backend_web': {} // Connect to Traefik network
        }
      }
    };

    // Add target URL to environment if provided
    if (targetUrl) {
      // Ensure the URL is properly formatted and validated
      let formattedUrl = targetUrl;
      
      // Add protocol if missing
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }
      
      // Validate URL format
      try {
        new URL(formattedUrl);
      } catch {
        logger.warn(`Invalid URL provided: ${targetUrl}, using default`);
        formattedUrl = 'https://www.duckduckgo.com';
      }
      
      logger.info(`Setting target URL for browser session ${sessionId}: ${formattedUrl}`);
      
      // Set the URL in environment variables for Kasm Chromium
      containerConfig.env = [
        ...CONTAINER_CONFIG.env.filter(env => !env.startsWith('CHROME_CLI=') && !env.startsWith('KASM_URL=') && !env.startsWith('KASM_APP_CONFIG=')),
        `CHROME_CLI=${formattedUrl}`,
        `KASM_URL=${formattedUrl}`,
        `KASM_APP_CONFIG={"url": "${formattedUrl}"}`,
        `TARGET_URL=${formattedUrl}`
      ];
    } else {
      // Use default URL if none provided
      containerConfig.env = [
        ...CONTAINER_CONFIG.env.filter(env => !env.startsWith('CHROME_CLI=') && !env.startsWith('KASM_URL=') && !env.startsWith('KASM_APP_CONFIG=')),
        'CHROME_CLI=https://www.duckduckgo.com',
        'KASM_URL=https://www.duckduckgo.com',
        'KASM_APP_CONFIG={"url": "https://www.duckduckgo.com"}'
      ];
    }

    // Create and start container
    const container = await docker.createContainer(containerConfig);
    await container.start();

    // Get container info
    const containerInfo = await container.inspect();
    
    // Store session info (without timeout reference to avoid circular JSON)
    const sessionInfo = {
      sessionId,
      userId,
      containerId: containerInfo.Id,
      containerName,
      status: 'running',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes auto-stop
      targetUrl,
      ports: {
        http: 3000,
        https: 3001
      }
    };
    
    activeSessions.set(sessionId, sessionInfo);

    // Set up automatic container stop (store timeout separately to avoid circular reference)
    const setupAutoCleanup = () => {
      const timeUntilExpiry = sessionInfo.expiresAt.getTime() - Date.now();
      
      if (timeUntilExpiry > 0) {
        setTimeout(async () => {
          try {
            const currentSession = activeSessions.get(sessionId);
            if (currentSession && currentSession.status === 'running') {
              logger.info(`Auto-stopping expired container: ${sessionId}`);
              
              const containerToStop = docker.getContainer(currentSession.containerId);
              
              try {
                // Check if container still exists
                await containerToStop.inspect();
                await containerToStop.stop({ t: 5 }); // Reduced timeout for faster cleanup
                logger.info(`Container auto-stopped: ${sessionId}`);
              } catch (error) {
                if (error.statusCode === 404) {
                  logger.info(`Container ${sessionId} was already stopped or removed`);
                } else {
                  logger.warn(`Failed to stop container ${sessionId}:`, error.message);
                }
              }
              
              // Clean up session data immediately
              activeSessions.delete(sessionId);
              logger.info(`Session cleaned up: ${sessionId}`);
            }
          } catch (error) {
            logger.error(`Failed to auto-stop container ${sessionId}:`, error.message);
            // Clean up session data even if container stop fails
            activeSessions.delete(sessionId);
          }
        }, timeUntilExpiry);
      }
    };

    // Setup initial auto-cleanup
    setupAutoCleanup();
    
    // REMOVED: Periodic cleanup that was causing conflicts with extend functionality
    // The session manager will handle periodic cleanup instead
    
    logger.info(`Browser container launched successfully: ${sessionId} -> ${containerName} (user: ${userId})`);
    
    // Calculate remaining minutes for the response
    const now = new Date();
    const remainingMs = sessionInfo.expiresAt.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, Math.round(remainingMs / (60 * 1000)));
    
    return {
      sessionId,
      userId,
      containerId: containerInfo.Id,
      browserUrl: isDevelopment ? 
        `http://${sessionId}.localhost:8001` : 
        `https://${sessionId}.disposable-services.duckdns.org`,
      expiresAt: sessionInfo.expiresAt,
      remainingMinutes: remainingMinutes, // Add remaining minutes to response
      status: 'running',
      ports: sessionInfo.ports
    };
    
  } catch (error) {
    logger.error(`Failed to launch browser container for session ${sessionId}, user ${userId}:`, error.message);
    throw new Error(`Failed to launch browser container: ${error.message}`);
  }
};

/**
 * Stop and remove a browser container
 * @param {string} sessionId - The session ID
 * @param {string} userId - The user ID (for validation)
 * @returns {Promise<boolean>} Success status
 */
export const stopBrowserContainer = async (sessionId, userId) => {
  try {
    logger.info(`Stopping browser container for session: ${sessionId}, user: ${userId}`);
    
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      logger.warn(`Session ${sessionId} not found in active sessions`);
      return false;
    }

    // Validate user owns this session
    if (sessionInfo.userId !== userId) {
      logger.warn(`User ${userId} attempted to stop session ${sessionId} owned by ${sessionInfo.userId}`);
      return false;
    }

    // Note: Timeout is managed separately to avoid circular JSON references

    const container = docker.getContainer(sessionInfo.containerId);
    
    try {
      // Check if container exists and is running
      const containerInfo = await container.inspect();
      
      if (containerInfo.State.Running) {
        // Stop container with timeout
        await container.stop({ t: 10 });
        logger.info(`Container stopped: ${sessionId}`);
      } else {
        logger.info(`Container ${sessionId} was already stopped`);
      }
      
      // Try to remove container (with autoRemove=true, it might already be removed)
      try {
        await container.remove({ force: true });
        logger.info(`Container removed: ${sessionId}`);
      } catch (removeError) {
        if (removeError.statusCode === 404) {
          logger.info(`Container ${sessionId} was already removed (autoRemove)`);
        } else if (removeError.statusCode === 409) {
          logger.info(`Container ${sessionId} removal already in progress`);
        } else {
          logger.warn(`Failed to remove container ${sessionId}:`, removeError.message);
        }
        // Don't throw error for remove failures - container cleanup is not critical
      }
      
    } catch (inspectError) {
      if (inspectError.statusCode === 404) {
        logger.info(`Container ${sessionId} no longer exists`);
      } else {
        logger.error(`Failed to inspect container ${sessionId}:`, inspectError.message);
        throw inspectError;
      }
    }
    
    // Remove from active sessions
    activeSessions.delete(sessionId);
    
    logger.info(`Browser container stopped and cleaned up: ${sessionId} (user: ${userId})`);
    return true;
    
  } catch (error) {
    logger.error(`Failed to stop browser container for session ${sessionId}, user ${userId}:`, error.message);
    throw new Error(`Failed to stop browser container: ${error.message}`);
  }
};

/**
 * Get container status
 * @param {string} sessionId - The session ID
 * @param {string} userId - The user ID (for validation)
 * @returns {Promise<Object>} Container status
 */
export const getContainerStatus = async (sessionId, userId) => {
  try {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      return { status: 'not_found' };
    }

    // Validate user owns this session
    if (sessionInfo.userId !== userId) {
      logger.warn(`User ${userId} attempted to access session ${sessionId} owned by ${sessionInfo.userId}`);
      return { status: 'not_found' };
    }

    const container = docker.getContainer(sessionInfo.containerId);
    const containerInfo = await container.inspect();
    
    return {
      sessionId,
      userId,
      status: containerInfo.State.Status,
      running: containerInfo.State.Running,
      startedAt: containerInfo.State.StartedAt,
      createdAt: sessionInfo.createdAt,
      expiresAt: sessionInfo.expiresAt,
      targetUrl: sessionInfo.targetUrl,
      ports: sessionInfo.ports
    };
    
  } catch (error) {
    logger.error(`Failed to get container status for session ${sessionId}, user ${userId}:`, error.message);
    return { status: 'error', error: error.message };
  }
};

/**
 * Extend session expiry time
 * @param {string} sessionId - The session ID
 * @param {number} additionalSeconds - Additional seconds to add
 * @param {string} userId - The user ID (for validation)
 * @returns {Promise<Object>} Updated session info
 */
export const extendSession = async (sessionId, additionalSeconds = 300, userId) => {
  try {
    // Debug logging to see what's being received
    logger.info(`Extending session ${sessionId} - DEBUG`, { 
      sessionId, 
      additionalSeconds, 
      additionalSecondsType: typeof additionalSeconds,
      additionalSecondsValue: additionalSeconds,
      userId,
      allParams: { sessionId, additionalSeconds, userId },
      expectedValue: 300,
      isCorrect: additionalSeconds === 300
    });
    
    // Ensure additionalSeconds is a number
    let additionalSecondsNum = 300; // Default 5 minutes in seconds to match UI
    if (additionalSeconds !== undefined && additionalSeconds !== null) {
      const parsed = parseInt(additionalSeconds);
      if (!isNaN(parsed)) {
        additionalSecondsNum = parsed;
      }
    }
    
    logger.info(`Using additionalSeconds: ${additionalSecondsNum} (original: ${additionalSeconds})`);
    
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Validate user owns this session
    if (sessionInfo.userId !== userId) {
      logger.warn(`User ${userId} attempted to extend session ${sessionId} owned by ${sessionInfo.userId}`);
      throw new Error(`Session ${sessionId} not found or permission denied`);
    }

    // Check if session has already expired
    const now = new Date();
    if (sessionInfo.expiresAt < now) {
      logger.warn(`Session ${sessionId} has already expired, cannot extend`);
      throw new Error(`Session ${sessionId} has already expired and cannot be extended`);
    }

    // Clear existing auto-cleanup timeout
    if (sessionInfo.autoCleanupTimeout) {
      clearTimeout(sessionInfo.autoCleanupTimeout);
      sessionInfo.autoCleanupTimeout = null;
    }

    // Calculate new expiry time (extend from current expiry time)
    const previousExpiresAt = sessionInfo.expiresAt; // Store the previous expiry time for logging
    
    // Extend from current expiry time - if you have 5 minutes left and extend by 5 minutes, you get 10 minutes total
    const newExpiryMs = sessionInfo.expiresAt.getTime() + (additionalSecondsNum * 1000);
    sessionInfo.expiresAt = new Date(newExpiryMs);
    
    // Set up new auto-cleanup timeout with updated expiry
    const timeUntilExpiry = sessionInfo.expiresAt.getTime() - Date.now();
    
    if (timeUntilExpiry > 0) {
      sessionInfo.autoCleanupTimeout = setTimeout(async () => {
        try {
          const currentSession = activeSessions.get(sessionId);
          if (currentSession && currentSession.status === 'running') {
            logger.info(`Auto-stopping expired container after extension: ${sessionId}`);
            
            const containerToStop = docker.getContainer(currentSession.containerId);
            
            try {
              await containerToStop.inspect();
              await containerToStop.stop({ t: 10 });
              logger.info(`Container auto-stopped after extension: ${sessionId}`);
            } catch {
              logger.info(`Container ${sessionId} was already stopped or removed`);
            }
            
            activeSessions.delete(sessionId);
            logger.info(`Session cleaned up after extension: ${sessionId}`);
          }
        } catch (error) {
          logger.error(`Failed to auto-stop extended container ${sessionId}:`, error.message);
        }
      }, timeUntilExpiry);
    }
    
    // Update session in the map
    activeSessions.set(sessionId, sessionInfo);
    
    const remainingMinutes = Math.round(timeUntilExpiry / (60 * 1000));
    
    // Debug logging for calculation
    const currentRemainingMs = sessionInfo.expiresAt.getTime() - now.getTime();
    logger.info(`Session ${sessionId} extension calculation - DEBUG`, {
      sessionId,
      userId,
      additionalSeconds,
      additionalSecondsNum,
      previousExpiresAt: previousExpiresAt.toISOString(),
      newExpiresAt: sessionInfo.expiresAt.toISOString(),
      currentRemainingMs,
      currentRemainingMinutes: Math.round(currentRemainingMs / (60 * 1000)),
      timeUntilExpiry,
      remainingMinutes,
      now: now.toISOString(),
      calculation: `Previous expiry: ${previousExpiresAt.toISOString()} + Extension: ${additionalSecondsNum / 60}min = New expiry: ${sessionInfo.expiresAt.toISOString()}`,
      extensionResult: `Extended by ${additionalSecondsNum} seconds, new total remaining: ${remainingMinutes} minutes`
    });
    
    return {
      sessionId,
      userId,
      expiresAt: sessionInfo.expiresAt,
      status: 'extended',
      remainingMinutes: Math.max(0, remainingMinutes) // Ensure non-negative
    };
    
  } catch (error) {
    logger.error(`Failed to extend session ${sessionId} for user ${userId}:`, error.message);
    throw new Error(`Failed to extend session: ${error.message}`);
  }
};

/**
 * Get all active sessions for a user
 * @param {string} userId - The user ID (optional, if not provided returns all sessions)
 * @returns {Array} Array of active session info for the user
 */
export const getActiveSessions = (userId = null) => {
  let sessions;
  if (userId) {
    // Filter sessions by user ID
    sessions = Array.from(activeSessions.values()).filter(session => session.userId === userId);
  } else {
    // Return all sessions (for admin use)
    sessions = Array.from(activeSessions.values());
  }
  
  // Create clean session objects without circular references
  return sessions.map(session => ({
    sessionId: session.sessionId,
    containerId: session.containerId,
    userId: session.userId,
    status: session.status,
    browserUrl: session.browserUrl,
    targetUrl: session.targetUrl,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    timeLeft: Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))
  }));
};

/**
 * Clean up expired sessions
 * @returns {Promise<number>} Number of sessions cleaned up
 */
export const cleanupExpiredSessions = async () => {
  try {
    const now = new Date();
    const expiredSessions = [];
    
    for (const [sessionId, sessionInfo] of activeSessions.entries()) {
      if (sessionInfo.expiresAt < now) {
        expiredSessions.push({ sessionId, sessionInfo });
      }
    }
    
    let cleanedCount = 0;
    for (const { sessionId, sessionInfo } of expiredSessions) {
      try {
        // Cleanup expired sessions by directly removing containers (bypass user validation)
        const container = docker.getContainer(sessionInfo.containerId);
        
        try {
          // Check if container exists before trying to stop it
          await container.inspect();
          await container.stop({ t: 10 });
          logger.info(`Stopped expired container: ${sessionId}`);
        } catch (error) {
          if (error.statusCode === 404) {
            logger.info(`Expired container ${sessionId} no longer exists`);
          } else {
            logger.warn(`Failed to stop expired container ${sessionId}:`, error.message);
          }
        }
        
        try {
          await container.remove({ force: true });
          logger.info(`Removed expired container: ${sessionId}`);
        } catch (removeError) {
          if (removeError.statusCode === 404) {
            logger.info(`Expired container ${sessionId} was already removed`);
          } else if (removeError.statusCode === 409) {
            logger.info(`Expired container ${sessionId} removal already in progress`);
          } else {
            logger.warn(`Failed to remove expired container ${sessionId}:`, removeError.message);
          }
          // Don't fail the cleanup for remove errors
        }
        
        activeSessions.delete(sessionId);
        
        logger.info(`Cleaned up expired session: ${sessionId} (user: ${sessionInfo.userId})`);
        cleanedCount++;
      } catch (error) {
        logger.error(`Failed to cleanup expired session ${sessionId}:`, error.message);
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired sessions`);
    }
    
    return cleanedCount;
    
  } catch (error) {
    logger.error('Failed to cleanup expired sessions:', error.message);
    return 0;
  }
};

/**
 * Get Docker system info
 * @returns {Promise<Object>} Docker system information
 */
export const getDockerInfo = async () => {
  try {
    const info = await docker.info();
    return {
      containers: info.Containers,
      images: info.Images,
      driver: info.Driver,
      kernelVersion: info.KernelVersion,
      operatingSystem: info.OperatingSystem
    };
  } catch (error) {
    logger.error('Failed to get Docker info:', error.message);
    throw error;
  }
};

export default docker;