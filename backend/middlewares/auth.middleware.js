import jwt from "jsonwebtoken";
import { JWT_SECRET, DEFAULT_EXTENSION_USER_ID } from "../config/env.js";
import { findUserById } from "../repositories/user.repository.js";
import logger from "../utils/logger.js";

const FALLBACK_EXTENSION_USER_ID = DEFAULT_EXTENSION_USER_ID || "default-user-id";

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    return req.headers.authorization.split(" ")[1];
  }

  if (req.query?.token) {
    return req.query.token;
  }

  return null;
};

const extractUserIdentifier = (req) => {
  const headerUserId = req.headers["x-user-id"] || req.headers["x-extension-user-id"];
  const bodyUserId = req.body?.userId || req.body?.user_id;
  const queryUserId = req.query?.userId || req.query?.user_id;

  return headerUserId || bodyUserId || queryUserId || null;
};

const resolveUserFromToken = async (token) => {
  if (!token) {
    return null;
  }

  const decoded = jwt.verify(token, JWT_SECRET);
  const user = await findUserById(decoded.userId);

  return user || null;
};

const handleUnauthorized = (res, error) => {
  return res.status(401).json({
    message: "Unauthorized",
    error: error?.message,
  });
};

const authorize = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new Error("Missing authentication token");
    }

    const user = await resolveUserFromToken(token);

    if (!user) {
      throw new Error("Invalid authentication token");
    }

    req.user = user;
    return next();
  } catch (error) {
    return handleUnauthorized(res, error);
  }
};

export const extensionAuthorize = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const user = await resolveUserFromToken(token);

      if (!user) {
        throw new Error("Invalid authentication token");
      }

      req.user = user;
      return next();
    }

    const providedUserId = extractUserIdentifier(req);
    const fallbackId = providedUserId || FALLBACK_EXTENSION_USER_ID;

    logger.info("Using extension fallback user identity", {
      fallbackId,
      providedUserId: Boolean(providedUserId),
      path: req.originalUrl,
      method: req.method,
    });

    req.user = {
      id: fallbackId,
      role: "USER",
      email: `${fallbackId}@safebox.local`,
      name: "Extension User",
      isFallback: true,
    };

    return next();
  } catch (error) {
    return handleUnauthorized(res, error);
  }
};

export default authorize;