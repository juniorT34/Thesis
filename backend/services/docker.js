import Docker from "dockerode"
import logger from "../utils/logger.js"
import { v4 as uuidv4 } from 'uuid'
import { NODE_ENV, CHROMIUM_BROWSER1 } from '../config/env.js'
import {
  createSessionRecord,
  updateSessionStatus,
  updateSessionExpiry,
  getSessionById,
  SESSION_TYPES,
  SESSION_STATUSES,
} from "../repositories/session.repository.js";
import { emitSessionEvent } from "./sessionEvents.js";

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
    portBindings: {
      '3000/tcp': [{ hostPort: '', hostIP: '0.0.0.0' }]
    },
    shmSize: 3221225472, // 3GB
    networkMode: 'bridge',
    securityOpt: ['seccomp=unconfined'],
    autoRemove: true,
    restartPolicy: {
      name: 'no'
    },
  },
  labels: {
    'com.disposable-services.type': 'browser-session',
    'com.disposable-services.created-by': 'safebox-api'
  }
};

// Session management
const activeSessions = new Map();

const DEFAULT_TARGET_URL = 'https://www.duckduckgo.com';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeTargetUrl = (targetUrl = DEFAULT_TARGET_URL) => {
  if (!targetUrl) return DEFAULT_TARGET_URL;

  const withProtocol = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    logger.warn(`Invalid URL provided: ${targetUrl}, using default`);
    return DEFAULT_TARGET_URL;
  }
};

const buildBrowserEnv = (targetUrl) => {
  const normalized = normalizeTargetUrl(targetUrl);
  return [
    ...CONTAINER_CONFIG.env.filter(
      (env) =>
        !env.startsWith('CHROME_CLI=') &&
        !env.startsWith('KASM_URL=') &&
        !env.startsWith('KASM_APP_CONFIG='),
    ),
    `CHROME_CLI=${normalized}`,
    `KASM_URL=${normalized}`,
    `KASM_APP_CONFIG={"url": "${normalized}"}`,
    `TARGET_URL=${normalized}`,
  ];
};

const waitUntilRunning = async (container, sessionId, maxAttempts = 20, delayMs = 1000) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const info = await container.inspect();
      if (info.State.Running) {
        return info;
      }
    } catch (error) {
      if (attempt >= maxAttempts - 1) {
        throw new Error(`Browser container ${sessionId} failed to start: ${error.message}`);
      }
    }
    await wait(delayMs);
  }
  throw new Error(`Browser container ${sessionId} failed to start`);
};

const stopContainerIfExists = async (container, sessionId, timeoutSeconds = 10) => {
  try {
    const info = await container.inspect();
    if (info.State.Running) {
      await container.stop({ t: timeoutSeconds });
      logger.info(`Container stopped: ${sessionId}`);
    } else {
      logger.info(`Container ${sessionId} was already stopped`);
    }
  } catch (error) {
    if (error.statusCode === 404) {
      logger.info(`Container ${sessionId} no longer exists`);
      return;
    }
    throw error;
  }
};

const removeContainerIfExists = async (container, sessionId) => {
  try {
    await container.remove({ force: true });
    logger.info(`Container removed: ${sessionId}`);
  } catch (error) {
    if (error.statusCode === 404) {
      logger.info(`Container ${sessionId} was already removed`);
    } else if (error.statusCode === 409) {
      logger.info(`Container ${sessionId} removal already in progress`);
    } else {
      logger.warn(`Failed to remove container ${sessionId}:`, error.message);
    }
  }
};

const buildEntryUrl = (sessionId, isDevelopment) =>
  isDevelopment
    ? `http://${sessionId}.localhost:8000`
    : `https://${sessionId}.disposable-services.duckdns.org`;

const scheduleBrowserExpiryCleanup = (sessionId, sessionInfo) => {
  const timeUntilExpiry = sessionInfo.expiresAt.getTime() - Date.now();
  if (timeUntilExpiry <= 0) {
    return;
  }

  sessionInfo.autoCleanupTimeout = setTimeout(async () => {
    try {
      const currentSession = activeSessions.get(sessionId);
      if (!currentSession || currentSession.status !== 'running') {
        return;
      }

      logger.info(`Auto-stopping expired container: ${sessionId}`);
      const containerToStop = docker.getContainer(currentSession.containerId);

      await stopContainerIfExists(containerToStop, sessionId, 5);
      await removeContainerIfExists(containerToStop, sessionId);

      activeSessions.delete(sessionId);
      await updateSessionStatus(sessionId, {
        status: SESSION_STATUSES.EXPIRED,
        stoppedAt: new Date(),
      });
      emitSessionEvent({
        action: 'expired',
        service: SESSION_TYPES.BROWSER,
        sessionId,
        userId: sessionInfo.userId,
        status: SESSION_STATUSES.EXPIRED,
      });
    } catch (error) {
      logger.error(`Failed to auto-stop container ${sessionId}:`, error.message);
      activeSessions.delete(sessionId);
      await updateSessionStatus(sessionId, {
        status: SESSION_STATUSES.EXPIRED,
        stoppedAt: new Date(),
        lastError: error.message,
      });
      emitSessionEvent({
        action: 'expired',
        service: SESSION_TYPES.BROWSER,
        sessionId,
        userId: sessionInfo.userId,
        status: SESSION_STATUSES.EXPIRED,
      });
    }
  }, timeUntilExpiry);
};

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
    // Set priority to ensure browser containers are routed before catch-all rules
    [`traefik.http.routers.browser-${sessionId}.priority`]: '10',
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

    containerConfig.env = buildBrowserEnv(targetUrl);

    // Create and start container
    const container = await docker.createContainer(containerConfig);
    await container.start();

    // Wait for container to be ready (browser containers need time to start)
    logger.info(`Waiting for browser container ${sessionId} to be ready...`);
    const containerInfo = await waitUntilRunning(container, sessionId);
    await wait(2000); // allow browser and Traefik to settle

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
      },
      autoCleanupTimeout: null
    };
    const browserEntryUrl = buildEntryUrl(sessionId, isDevelopment);
    sessionInfo.browserUrl = browserEntryUrl;
    
    activeSessions.set(sessionId, sessionInfo);

    emitSessionEvent({
      action: 'started',
      service: SESSION_TYPES.BROWSER,
      sessionId,
      userId,
      status: SESSION_STATUSES.RUNNING,
    });

    await createSessionRecord({
      sessionId,
      userId,
      type: SESSION_TYPES.BROWSER,
      status: SESSION_STATUSES.RUNNING,
      targetUrl,
      entryUrl: browserEntryUrl,
      containerId: containerInfo.Id,
      expiresAt: sessionInfo.expiresAt,
    });

    scheduleBrowserExpiryCleanup(sessionId, sessionInfo);
    // Session manager handles periodic cleanup
    
    logger.info(`Browser container launched successfully: ${sessionId} -> ${containerName} (user: ${userId})`);
    
    // Calculate remaining minutes for the response
    const now = new Date();
    const remainingMs = sessionInfo.expiresAt.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, Math.round(remainingMs / (60 * 1000)));
    
    return {
      sessionId,
      userId,
      containerId: containerInfo.Id,
      browserUrl: browserEntryUrl,
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
export const stopBrowserContainer = async (sessionId, userId, bypassOwnership = false) => {
  try {
    logger.info(`Stopping browser container for session: ${sessionId}, user: ${userId}`);
    
    let sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      logger.warn(`Session ${sessionId} not found in active sessions, attempting to recover from database`);
      const persisted = await getSessionById(sessionId);
      if (!persisted) {
        logger.warn(`Session ${sessionId} not found in database`);
        return false;
      }

      if (persisted.userId && persisted.userId !== userId && !bypassOwnership) {
        logger.warn(`User ${userId} attempted to stop session ${sessionId} owned by ${persisted.userId}`);
        return false;
      }

      sessionInfo = {
        sessionId,
        userId: persisted.userId || userId,
        containerId: persisted.containerId || sessionId,
      };
    }

    // Validate user owns this session
    if (sessionInfo.userId !== userId && !bypassOwnership) {
      logger.warn(`User ${userId} attempted to stop session ${sessionId} owned by ${sessionInfo.userId}`);
      return false;
    }

    const containerRef = sessionInfo.containerId || sessionId;
    const container = docker.getContainer(containerRef);
    
    try {
      await stopContainerIfExists(container, sessionId, 10);
      await removeContainerIfExists(container, sessionId);
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
    await updateSessionStatus(sessionId, {
      status: SESSION_STATUSES.STOPPED,
      stoppedAt: new Date(),
    });
    emitSessionEvent({
      action: 'stopped',
      service: SESSION_TYPES.BROWSER,
      sessionId,
      userId: sessionInfo.userId,
      status: SESSION_STATUSES.STOPPED,
    });
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
export const extendSession = async (sessionId, additionalSeconds = 300, userId, bypassOwnership = false) => {
  try {
    let additionalSecondsNum = 300; // Default 5 minutes to match UI
    if (additionalSeconds !== undefined && additionalSeconds !== null) {
      const parsed = parseInt(additionalSeconds, 10);
      if (!Number.isNaN(parsed)) {
        additionalSecondsNum = parsed;
      }
    }

    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Validate user owns this session
    if (sessionInfo.userId !== userId && !bypassOwnership) {
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

    // Extend from current expiry time
    const newExpiryMs = sessionInfo.expiresAt.getTime() + additionalSecondsNum * 1000;
    sessionInfo.expiresAt = new Date(newExpiryMs);
    
    // Set up new auto-cleanup timeout with updated expiry
    scheduleBrowserExpiryCleanup(sessionId, sessionInfo);

    activeSessions.set(sessionId, sessionInfo);
    
    const timeUntilExpiry = sessionInfo.expiresAt.getTime() - Date.now();
    const remainingMinutes = Math.max(0, Math.round(timeUntilExpiry / (60 * 1000)));

    await updateSessionExpiry(sessionId, sessionInfo.expiresAt);
    logger.info(`Extended session ${sessionId} by ${additionalSecondsNum}s for user ${userId}`);
    
    const result = {
      sessionId,
      userId,
      expiresAt: sessionInfo.expiresAt,
      status: 'extended',
      remainingMinutes: Math.max(0, remainingMinutes) // Ensure non-negative
    };

    emitSessionEvent({
      action: 'extended',
      service: SESSION_TYPES.BROWSER,
      sessionId,
      userId: sessionInfo.userId,
      status: 'extended',
      remainingMinutes: result.remainingMinutes,
    });
    
    return result;
    
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
    type: 'browser',
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
        
        await stopContainerIfExists(container, sessionId, 10);
        await removeContainerIfExists(container, sessionId);
        
        activeSessions.delete(sessionId);
        
        logger.info(`Cleaned up expired session: ${sessionId} (user: ${sessionInfo.userId})`);
        await updateSessionStatus(sessionId, {
          status: SESSION_STATUSES.EXPIRED,
          stoppedAt: new Date(),
        });
        emitSessionEvent({
          action: 'expired',
          service: SESSION_TYPES.BROWSER,
          sessionId,
          userId: sessionInfo.userId,
          status: SESSION_STATUSES.EXPIRED,
        });
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