import {
  listSessionsByUser,
  listAllSessions,
} from "../repositories/session.repository.js";
import logger from "../utils/logger.js";
import { registerSessionListener } from "../services/sessionEvents.js";

const mapSessionsResponse = (sessions = []) =>
  sessions.map(session => ({
    ...session,
    remainingMinutes:
      typeof session.timeLeft === "number" ? Math.round(session.timeLeft / 60) : undefined,
  }));

const ensureAuthenticated = (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return null;
  }
  return userId;
};

export const getUserSessionsHistory = async (req, res) => {
  try {
    const userId = ensureAuthenticated(req, res);
    if (!userId) return;
    logger.info(`User ${userId} requested session history`);
    const sessions = await listSessionsByUser(userId);

    res.status(200).json({
      success: true,
      message: "Session history retrieved successfully",
      data: mapSessionsResponse(sessions),
    });
  } catch (error) {
    logger.error(`Failed to get session history: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve session history",
      error: error.message,
    });
  }
};

export const getAdminSessionsHistory = async (req, res) => {
  try {
    logger.info("Admin requested global session history");
    const sessions = await listAllSessions();

    res.status(200).json({
      success: true,
      message: "Admin session history retrieved successfully",
      data: mapSessionsResponse(sessions),
    });
  } catch (error) {
    logger.error(`Failed to get admin session history: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve admin session history",
      error: error.message,
    });
  }
};

export const streamSessionEvents = (req, res) => {
  const userId = ensureAuthenticated(req, res);
  if (!userId) return;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const isAdmin = req.user?.role === "ADMIN";

  const sendEvent = (payload) => {
    if (!isAdmin && payload.userId && payload.userId !== userId) {
      return;
    }
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const unsubscribe = registerSessionListener(sendEvent);
  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};
