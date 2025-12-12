import { query } from "../database/postgres.js";
import logger from "../utils/logger.js";

export const SESSION_TYPES = {
  BROWSER: "browser",
  DESKTOP: "desktop",
};

export const SESSION_STATUSES = {
  RUNNING: "running",
  STOPPED: "stopped",
  EXPIRED: "expired",
  ERROR: "error",
};

const mapRowToSessionDto = (row) => {
  if (!row) return null;
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const stoppedAt = row.stopped_at ? new Date(row.stopped_at) : null;
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  const now = Date.now();
  const timeLeft =
    expiresAt && row.status === SESSION_STATUSES.RUNNING
      ? Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000))
      : 0;

  return {
    sessionId: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    targetUrl: row.target_url,
    browserUrl: row.type === SESSION_TYPES.BROWSER ? row.entry_url : undefined,
    desktopUrl: row.type === SESSION_TYPES.DESKTOP ? row.entry_url : undefined,
    url: row.entry_url,
    flavor: row.flavor || undefined,
    containerId: row.container_id || undefined,
    createdAt: createdAt?.toISOString(),
    expiresAt: expiresAt?.toISOString(),
    stoppedAt: stoppedAt?.toISOString(),
    lastError: row.last_error || undefined,
    timeLeft,
  };
};

export const createSessionRecord = async ({
  sessionId,
  userId,
  type,
  status = SESSION_STATUSES.RUNNING,
  targetUrl = null,
  entryUrl = null,
  containerId = null,
  flavor = null,
  expiresAt = null,
}) => {
  try {
    await query(
      `
      INSERT INTO sessions (id, user_id, type, status, target_url, entry_url, container_id, flavor, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        target_url = EXCLUDED.target_url,
        entry_url = EXCLUDED.entry_url,
        container_id = EXCLUDED.container_id,
        flavor = EXCLUDED.flavor,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW();
    `,
      [sessionId, userId, type, status, targetUrl, entryUrl, containerId, flavor, expiresAt],
    );
  } catch (error) {
    logger.warn(`Failed to persist session ${sessionId}: ${error.message}`);
  }
};

export const updateSessionStatus = async (sessionId, { status, stoppedAt = null, lastError = null, entryUrl = null } = {}) => {
  try {
    await query(
      `
      UPDATE sessions
      SET status = COALESCE($2, status),
          stopped_at = COALESCE($3, stopped_at),
          last_error = COALESCE($4, last_error),
          entry_url = COALESCE($5, entry_url),
          updated_at = NOW()
      WHERE id = $1;
    `,
      [sessionId, status, stoppedAt, lastError, entryUrl],
    );
  } catch (error) {
    logger.warn(`Failed to update session ${sessionId}: ${error.message}`);
  }
};

export const updateSessionExpiry = async (sessionId, expiresAt) => {
  try {
    await query(
      `
      UPDATE sessions
      SET expires_at = $2,
          updated_at = NOW()
      WHERE id = $1;
    `,
      [sessionId, expiresAt],
    );
  } catch (error) {
    logger.warn(`Failed to update session expiry for ${sessionId}: ${error.message}`);
  }
};

export const listSessionsByUser = async (userId, limit = 100) => {
  const { rows } = await query(
    `
    SELECT *
    FROM sessions
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
  `,
    [userId, limit],
  );
  return rows.map(mapRowToSessionDto);
};

export const listAllSessions = async (limit = 200) => {
  const { rows } = await query(
    `
    SELECT *
    FROM sessions
    ORDER BY created_at DESC
    LIMIT $1;
  `,
    [limit],
  );
  return rows.map(mapRowToSessionDto);
};

export const getSessionById = async (sessionId) => {
  const { rows } = await query(
    `
    SELECT *
    FROM sessions
    WHERE id = $1;
  `,
    [sessionId],
  );
  return mapRowToSessionDto(rows[0]);
};

