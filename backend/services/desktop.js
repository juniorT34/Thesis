import Docker from "dockerode"
import logger from "../utils/logger.js"
import { v4 as uuidv4 } from 'uuid'
import { NODE_ENV, UBUNTU_DESKTOP, DEBIAN_DESKTOP, FEDORA_DESKTOP, ALPINE_DESKTOP, ARCH_DESKTOP } from '../config/env.js'
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

// Desktop container configuration based on linuxserver.io images
const DESKTOP_CONFIGS = {
  ubuntu: {
    image: UBUNTU_DESKTOP || 'linuxserver/webtop:ubuntu-xfce',
    env: [
      'PUID=1000',
      'PGID=1000',
      'TZ=UTC',
      'TITLE=Disposable Ubuntu Desktop',
    ]
  },
  debian: {
    image: DEBIAN_DESKTOP || 'linuxserver/webtop:debian-xfce',
    env: [
      'PUID=1000',
      'PGID=1000',
      'TZ=UTC',
      'TITLE=Disposable Debian Desktop'
    ]
  },
  fedora: {
    image: FEDORA_DESKTOP || 'linuxserver/webtop:fedora-xfce',
    env: [
      'PUID=1000',
      'PGID=1000',
      'TZ=UTC',
      'TITLE=Disposable Fedora Desktop'
    ]
  },
  alpine: {
    image: ALPINE_DESKTOP || 'linuxserver/webtop:alpine-xfce',
    env: [
      'PUID=1000',
      'PGID=1000',
      'TZ=UTC',
      'TITLE=Disposable Alpine Desktop'
    ]
  },
  arch: {
    image: ARCH_DESKTOP || 'linuxserver/webtop:arch-xfce',
    env: [
      'PUID=1000',
      'PGID=1000',
      'TZ=UTC',
      'TITLE=Disposable Arch Desktop'
    ]
  }
};

// Session management for desktop containers
const activeDesktopSessions = new Map();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitUntilRunning = async (container, sessionId, maxAttempts = 15, delayMs = 1000) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const info = await container.inspect();
      if (info.State.Running) {
        return info;
      }
    } catch (error) {
      if (attempt >= maxAttempts - 1) {
        throw new Error(`Desktop container ${sessionId} failed to start: ${error.message}`);
      }
    }
    await wait(delayMs);
  }
  throw new Error(`Desktop container ${sessionId} failed to start`);
};

const stopContainerIfExists = async (container, sessionId, timeoutSeconds = 10) => {
  try {
    const info = await container.inspect();
    if (info.State.Running) {
      await container.stop({ t: timeoutSeconds });
      logger.info(`Desktop container stopped: ${sessionId}`);
    } else {
      logger.info(`Desktop container ${sessionId} was already stopped`);
    }
  } catch (error) {
    if (error.statusCode === 404) {
      logger.info(`Desktop container ${sessionId} no longer exists`);
      return;
    }
    throw error;
  }
};

const removeContainerIfExists = async (container, sessionId) => {
  try {
    await container.remove({ force: true });
    logger.info(`Desktop container removed: ${sessionId}`);
  } catch (error) {
    if (error.statusCode === 404) {
      logger.info(`Desktop container ${sessionId} was already removed`);
    } else if (error.statusCode === 409) {
      logger.info(`Desktop container ${sessionId} removal already in progress`);
    } else {
      logger.warn(`Failed to remove desktop container ${sessionId}:`, error.message);
    }
  }
};

const buildEntryUrl = (sessionId, isDevelopment) =>
  isDevelopment
    ? `http://${sessionId}.localhost:8000`
    : `https://${sessionId}.disposable-services.duckdns.org`;

const scheduleDesktopExpiryCleanup = (sessionId, sessionInfo) => {
  const timeUntilExpiry = sessionInfo.expiresAt.getTime() - Date.now();
  if (timeUntilExpiry <= 0) {
    return;
  }

  sessionInfo.autoCleanupTimeout = setTimeout(async () => {
    try {
      const currentSession = activeDesktopSessions.get(sessionId);
      if (!currentSession || currentSession.status !== 'running') {
        return;
      }

      logger.info(`Auto-stopping expired desktop container: ${sessionId}`);
      const containerToStop = docker.getContainer(currentSession.containerId);

      await stopContainerIfExists(containerToStop, sessionId, 5);
      await removeContainerIfExists(containerToStop, sessionId);

      activeDesktopSessions.delete(sessionId);
      await updateSessionStatus(sessionId, {
        status: SESSION_STATUSES.EXPIRED,
        stoppedAt: new Date(),
      });
      emitSessionEvent({
        action: 'expired',
        service: SESSION_TYPES.DESKTOP,
        sessionId,
        userId: sessionInfo.userId,
        status: SESSION_STATUSES.EXPIRED,
      });
    } catch (error) {
      logger.error(`Failed to auto-stop desktop container ${sessionId}:`, error.message);
      activeDesktopSessions.delete(sessionId);
      await updateSessionStatus(sessionId, {
        status: SESSION_STATUSES.EXPIRED,
        stoppedAt: new Date(),
        lastError: error.message,
      });
      emitSessionEvent({
        action: 'expired',
        service: SESSION_TYPES.DESKTOP,
        sessionId,
        userId: sessionInfo.userId,
        status: SESSION_STATUSES.EXPIRED,
      });
    }
  }, timeUntilExpiry);
};

/**
 * Generate a unique desktop session ID
 * @returns {string} Unique session ID
 */
export const generateDesktopSessionId = () => {
  const shortId = uuidv4().replace(/-/g, '').substring(0, 8);
  return `desktop-session_${shortId}`;
};

/**
 * Create Traefik labels for desktop dynamic routing
 * @param {string} sessionId - The session ID
 * @returns {Object} Traefik labels object
 */
export const generateDesktopTraefikLabels = (sessionId) => {
  const isDevelopment = NODE_ENV === 'development';
  const domain = isDevelopment ? 'localhost' : 'disposable-services.duckdns.org';
  
  const labels = {
    'traefik.enable': 'true',
    [`traefik.http.routers.desktop-${sessionId}.rule`]: `Host(\`${sessionId}.${domain}\`)`,
    [`traefik.http.services.desktop-${sessionId}.loadbalancer.server.port`]: '3000',
    'com.disposable-services.session-id': sessionId,
    'com.disposable-services.type': 'desktop-session',
    'com.disposable-services.created-by': 'safebox-api'
  };

  if (isDevelopment) {
    labels[`traefik.http.routers.desktop-${sessionId}.entrypoints`] = 'web';
  } else {
    labels[`traefik.http.routers.desktop-${sessionId}.entrypoints`] = 'web,websecure';
    labels[`traefik.http.routers.desktop-${sessionId}.tls.certresolver`] = 'letsencrypt';
  }

  return labels;
};

/**
 * Launch a new desktop container
 * @param {string} sessionId - The session ID
 * @param {string} flavor - The Linux flavor (ubuntu, debian, fedora, alpine, arch)
 * @param {string} userId - The user ID who owns this session
 * @returns {Promise<Object>} Container info
 */
export const launchDesktopContainer = async (sessionId, flavor = 'ubuntu', userId) => {
  try {
    logger.info(`Launching desktop container for session: ${sessionId}, flavor: ${flavor}, user: ${userId}`);
    
    // Validate flavor
    if (!DESKTOP_CONFIGS[flavor]) {
      throw new Error(`Unsupported desktop flavor: ${flavor}. Supported flavors: ${Object.keys(DESKTOP_CONFIGS).join(', ')}`);
    }
    
    const containerName = sessionId;
    const isDevelopment = NODE_ENV === 'development';
    
    // Get configuration for the selected flavor
    const flavorConfig = DESKTOP_CONFIGS[flavor];
    
    // Create container configuration
    const containerConfig = {
      image: flavorConfig.image,
      name: containerName,
      env: flavorConfig.env,
      exposedPorts: {
        '3000/tcp': {} // VNC web interface
      },
      hostConfig: {
        portBindings: {
          '3000/tcp': [{ hostPort: '', hostIP: '0.0.0.0' }]
        },
        shmSize: 3221225472, // 3GB shared memory
        networkMode: 'bridge',
        securityOpt: ['seccomp=unconfined'],
        autoRemove: true,
        restartPolicy: {
          name: 'no'
        }
      },
      labels: {
        ...generateDesktopTraefikLabels(sessionId),
        'com.disposable-services.session-id': sessionId,
        'com.disposable-services.user-id': userId,
        'com.disposable-services.flavor': flavor
      },
      networkingConfig: {
        endpointsConfig: {
          'backend_web': {}
        }
      }
    };

    const container = await docker.createContainer(containerConfig);
    await container.start();

    logger.info(`Waiting for desktop container ${sessionId} to be ready...`);
    const containerInfo = await waitUntilRunning(container, sessionId);
    await wait(3000); // allow VNC to initialize
    
    // Store session info
    const sessionInfo = {
      sessionId,
      userId,
      flavor,
      containerId: containerInfo.Id,
      containerName,
      status: 'running',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes auto-stop
      autoCleanupTimeout: null
    };
    const desktopEntryUrl = buildEntryUrl(sessionId, isDevelopment);
    sessionInfo.desktopUrl = desktopEntryUrl;
    
    activeDesktopSessions.set(sessionId, sessionInfo);

    emitSessionEvent({
      action: 'started',
      service: SESSION_TYPES.DESKTOP,
      sessionId,
      userId,
      status: SESSION_STATUSES.RUNNING,
      flavor,
    });

    await createSessionRecord({
      sessionId,
      userId,
      type: SESSION_TYPES.DESKTOP,
      status: SESSION_STATUSES.RUNNING,
      entryUrl: desktopEntryUrl,
      containerId: containerInfo.Id,
      flavor,
      targetUrl: null,
      expiresAt: sessionInfo.expiresAt,
    });

    scheduleDesktopExpiryCleanup(sessionId, sessionInfo);
    // Session manager handles periodic cleanup
    
    logger.info(`Desktop container launched successfully: ${sessionId} -> ${containerName} (flavor: ${flavor}, user: ${userId})`);
    
    // Calculate remaining minutes for the response
    const now = new Date();
    const remainingMs = sessionInfo.expiresAt.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, Math.round(remainingMs / (60 * 1000)));
    
    return {
      sessionId,
      userId,
      flavor,
      containerId: containerInfo.Id,
      desktopUrl: desktopEntryUrl,
      expiresAt: sessionInfo.expiresAt,
      remainingMinutes: remainingMinutes, // Add remaining minutes to response
      status: 'running'
    };
    
  } catch (error) {
    logger.error(`Failed to launch desktop container for session ${sessionId}, flavor ${flavor}, user ${userId}:`, error.message);
    throw new Error(`Failed to launch desktop container: ${error.message}`);
  }
};

/**
 * Stop and remove a desktop container
 * @param {string} sessionId - The session ID
 * @param {string} userId - The user ID (for validation)
 * @returns {Promise<boolean>} Success status
 */
export const stopDesktopContainer = async (sessionId, userId, bypassOwnership = false) => {
  try {
    logger.info(`Stopping desktop container for session: ${sessionId}, user: ${userId}`);
    
    let sessionInfo = activeDesktopSessions.get(sessionId);
    if (!sessionInfo) {
      logger.warn(`Desktop session ${sessionId} not found in active sessions, attempting to recover from database`);
      const persisted = await getSessionById(sessionId);
      if (!persisted) {
        logger.warn(`Desktop session ${sessionId} not found in database`);
        return false;
      }

      if (persisted.userId && persisted.userId !== userId && !bypassOwnership) {
        logger.warn(`User ${userId} attempted to stop desktop session ${sessionId} owned by ${persisted.userId}`);
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
      logger.warn(`User ${userId} attempted to stop desktop session ${sessionId} owned by ${sessionInfo.userId}`);
      return false;
    }

    if (sessionInfo.autoCleanupTimeout) {
      clearTimeout(sessionInfo.autoCleanupTimeout);
      sessionInfo.autoCleanupTimeout = null;
    }

    const containerRef = sessionInfo.containerId || sessionId;
    const container = docker.getContainer(containerRef);
    
    try {
      await stopContainerIfExists(container, sessionId, 10);
      await removeContainerIfExists(container, sessionId);
    } catch (inspectError) {
      if (inspectError.statusCode === 404) {
        logger.info(`Desktop container ${sessionId} no longer exists`);
      } else {
        logger.error(`Failed to inspect desktop container ${sessionId}:`, inspectError.message);
        throw inspectError;
      }
    }
    
    // Remove from active sessions
    activeDesktopSessions.delete(sessionId);
    
    logger.info(`Desktop container stopped and cleaned up: ${sessionId} (user: ${userId})`);
    await updateSessionStatus(sessionId, {
      status: SESSION_STATUSES.STOPPED,
      stoppedAt: new Date(),
    });
    emitSessionEvent({
      action: 'stopped',
      service: SESSION_TYPES.DESKTOP,
      sessionId,
      userId: sessionInfo.userId,
      status: SESSION_STATUSES.STOPPED,
    });
    return true;
    
  } catch (error) {
    logger.error(`Failed to stop desktop container for session ${sessionId}, user ${userId}:`, error.message);
    throw new Error(`Failed to stop desktop container: ${error.message}`);
  }
};

/**
 * Get desktop container status
 * @param {string} sessionId - The session ID
 * @param {string} userId - The user ID (for validation)
 * @returns {Promise<Object>} Container status
 */
export const getDesktopContainerStatus = async (sessionId, userId) => {
  try {
    const sessionInfo = activeDesktopSessions.get(sessionId);
    if (!sessionInfo) {
      return { status: 'not_found' };
    }

    // Validate user owns this session
    if (sessionInfo.userId !== userId) {
      logger.warn(`User ${userId} attempted to access desktop session ${sessionId} owned by ${sessionInfo.userId}`);
      return { status: 'not_found' };
    }

    const container = docker.getContainer(sessionInfo.containerId);
    const containerInfo = await container.inspect();
    
    return {
      sessionId,
      userId,
      flavor: sessionInfo.flavor,
      status: containerInfo.State.Status,
      running: containerInfo.State.Running,
      startedAt: containerInfo.State.StartedAt,
      createdAt: sessionInfo.createdAt,
      expiresAt: sessionInfo.expiresAt
    };
    
  } catch (error) {
    logger.error(`Failed to get desktop container status for session ${sessionId}, user ${userId}:`, error.message);
    return { status: 'error', error: error.message };
  }
};

/**
 * Extend desktop session expiry time
 * @param {string} sessionId - The session ID
 * @param {number} additionalSeconds - Additional seconds to add
 * @param {string} userId - The user ID (for validation)
 * @returns {Promise<Object>} Updated session info
 */
export const extendDesktopSession = async (sessionId, additionalSeconds = 300, userId, bypassOwnership = false) => {
  try {
    let additionalSecondsNum = 300;
    if (additionalSeconds !== undefined && additionalSeconds !== null) {
      const parsed = parseInt(additionalSeconds, 10);
      if (!Number.isNaN(parsed)) {
        additionalSecondsNum = parsed;
      }
    }
    
    const sessionInfo = activeDesktopSessions.get(sessionId);
    if (!sessionInfo) {
      throw new Error(`Desktop session ${sessionId} not found`);
    }

    // Validate user owns this session
    if (sessionInfo.userId !== userId && !bypassOwnership) {
      logger.warn(`User ${userId} attempted to extend desktop session ${sessionId} owned by ${sessionInfo.userId}`);
      throw new Error(`Desktop session ${sessionId} not found or permission denied`);
    }

    // Check if session has already expired
    const now = new Date();
    if (sessionInfo.expiresAt < now) {
      logger.warn(`Desktop session ${sessionId} has already expired, cannot extend`);
      throw new Error(`Desktop session ${sessionId} has already expired and cannot be extended`);
    }

    // Clear existing auto-cleanup timeout
    if (sessionInfo.autoCleanupTimeout) {
      clearTimeout(sessionInfo.autoCleanupTimeout);
      sessionInfo.autoCleanupTimeout = null;
    }

    const newExpiryMs = sessionInfo.expiresAt.getTime() + additionalSecondsNum * 1000;
    sessionInfo.expiresAt = new Date(newExpiryMs);
    
    scheduleDesktopExpiryCleanup(sessionId, sessionInfo);

    activeDesktopSessions.set(sessionId, sessionInfo);
    
    const timeUntilExpiry = sessionInfo.expiresAt.getTime() - Date.now();
    const remainingMinutes = Math.max(0, Math.round(timeUntilExpiry / (60 * 1000)));

    await updateSessionExpiry(sessionId, sessionInfo.expiresAt);
    logger.info(`Extended desktop session ${sessionId} by ${additionalSecondsNum}s for user ${userId}`);
    
    const result = {
      sessionId,
      userId,
      flavor: sessionInfo.flavor,
      expiresAt: sessionInfo.expiresAt,
      status: 'extended',
      remainingMinutes: Math.max(0, remainingMinutes) // Ensure non-negative
    };

    emitSessionEvent({
      action: 'extended',
      service: SESSION_TYPES.DESKTOP,
      sessionId,
      userId: sessionInfo.userId,
      status: 'extended',
      remainingMinutes: result.remainingMinutes,
    });

    return result;
    
  } catch (error) {
    logger.error(`Failed to extend desktop session ${sessionId} for user ${userId}:`, error.message);
    throw new Error(`Failed to extend desktop session: ${error.message}`);
  }
};

/**
 * Get all active desktop sessions for a user
 * @param {string} userId - The user ID (optional, if not provided returns all sessions)
 * @returns {Array} Array of active session info for the user
 */
export const getActiveDesktopSessions = (userId = null) => {
  let sessions;
  if (userId) {
    sessions = Array.from(activeDesktopSessions.values()).filter(session => session.userId === userId);
  } else {
    sessions = Array.from(activeDesktopSessions.values());
  }
  
  // Create clean session objects without circular references
  return sessions.map(session => ({
    sessionId: session.sessionId,
    containerId: session.containerId,
    userId: session.userId,
    status: session.status,
    type: 'desktop',
    flavor: session.flavor,
    desktopUrl: session.desktopUrl,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    timeLeft: Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))
  }));
};

/**
 * Clean up expired desktop sessions
 * @returns {Promise<number>} Number of sessions cleaned up
 */
export const cleanupExpiredDesktopSessions = async () => {
  try {
    const now = new Date();
    const expiredSessions = [];
    
    for (const [sessionId, sessionInfo] of activeDesktopSessions.entries()) {
      if (sessionInfo.expiresAt < now) {
        expiredSessions.push({ sessionId, sessionInfo });
      }
    }
    
    let cleanedCount = 0;
    for (const { sessionId, sessionInfo } of expiredSessions) {
      try {
        if (sessionInfo.autoCleanupTimeout) {
          clearTimeout(sessionInfo.autoCleanupTimeout);
          sessionInfo.autoCleanupTimeout = null;
        }

        const container = docker.getContainer(sessionInfo.containerId);
        await stopContainerIfExists(container, sessionId, 10);
        await removeContainerIfExists(container, sessionId);
        
        activeDesktopSessions.delete(sessionId);
        
        logger.info(`Cleaned up expired desktop session: ${sessionId} (user: ${sessionInfo.userId})`);
        await updateSessionStatus(sessionId, {
          status: SESSION_STATUSES.EXPIRED,
          stoppedAt: new Date(),
        });
        emitSessionEvent({
          action: 'expired',
          service: SESSION_TYPES.DESKTOP,
          sessionId,
          userId: sessionInfo.userId,
          status: SESSION_STATUSES.EXPIRED,
        });
        cleanedCount++;
      } catch (error) {
        logger.error(`Failed to cleanup expired desktop session ${sessionId}:`, error.message);
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired desktop sessions`);
    }
    
    return cleanedCount;
    
  } catch (error) {
    logger.error('Failed to cleanup expired desktop sessions:', error.message);
    return 0;
  }
};

export default docker;
