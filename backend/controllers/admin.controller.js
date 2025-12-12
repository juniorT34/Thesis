import bcrypt from "bcrypt";
import {
  listUsers,
  updateUserRole as updateUserRoleRepo,
  USER_ROLES,
  countUsersByRole,
  countTotalUsers,
  createUser,
  findUserByEmail,
  updateUser as updateUserRepo,
  deleteUserById,
  findUserById,
} from "../repositories/user.repository.js";
import { getActiveSessions } from "../services/docker.js";
import { getActiveDesktopSessions } from "../services/desktop.js";
import { executeCommandInSession, fetchSessionLogs, fetchSessionResourceUsage } from "../services/adminSessions.js";
import logger from "../utils/logger.js";

const isValidRole = (role) => Object.values(USER_ROLES).includes(role);
const normalizeEmail = (email = "") => email.trim().toLowerCase();

export const getUsers = async (req, res) => {
  try {
    const users = await listUsers();
    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users,
    });
  } catch (error) {
    logger.error(`Failed to fetch users: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !isValidRole(role)) {
      return res.status(400).json({
        success: false,
        message: "A valid role is required",
      });
    }

    if (req.user?.id === id && req.user.role === role) {
      return res.status(200).json({
        success: true,
        message: "Role unchanged",
        data: req.user,
      });
    }

    const updatedUser = await updateUserRoleRepo(id, role);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info(`Admin ${req.user?.email} updated role for user ${updatedUser.email} -> ${role}`);

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    logger.error(`Failed to update user role: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
      error: error.message,
    });
  }
};

export const createUserAccount = async (req, res) => {
  try {
    const { name, email, password, role = USER_ROLES.USER } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    if (!isValidRole(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role provided",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with that email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await createUser({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
    });

    logger.info(`Admin ${req.user?.email} created user ${newUser.email} (${role})`);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: newUser,
    });
  } catch (error) {
    logger.error(`Failed to create user: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
};

export const updateUserAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body || {};

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User id is required",
      });
    }

    if (!name && !email && !role && !password) {
      return res.status(400).json({
        success: false,
        message: "At least one field must be provided for update",
      });
    }

    const existingUser = await findUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updates = {};

    if (name) {
      updates.name = name.trim();
    }

    if (email) {
      const normalizedEmail = normalizeEmail(email);
      if (normalizedEmail !== existingUser.email) {
        const emailOwner = await findUserByEmail(normalizedEmail);
        if (emailOwner && emailOwner.id !== id) {
          return res.status(409).json({
            success: false,
            message: "Another user already uses that email",
          });
        }
      }
      updates.email = normalizedEmail;
    }

    if (role) {
      if (!isValidRole(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role provided",
        });
      }
      updates.role = role;
    }

    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await updateUserRepo(id, updates);

    logger.info(`Admin ${req.user?.email} updated user ${existingUser.email}`);

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    logger.error(`Failed to update user: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};

export const deleteUserAccount = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User id is required",
      });
    }

    if (req.user?.id === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const deletedUser = await deleteUserById(id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.warn(`Admin ${req.user?.email} deleted user ${deletedUser.email}`);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: { id: deletedUser.id },
    });
  } catch (error) {
    logger.error(`Failed to delete user: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

export const getAdminStats = async (req, res) => {
  try {
    const [roleCounts, totalUsers] = await Promise.all([countUsersByRole(), countTotalUsers()]);
    const browserSessions = getActiveSessions();
    const desktopSessions = getActiveDesktopSessions();

    const roleBreakdown = roleCounts.reduce((acc, current) => {
      acc[current.role] = current.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: "Admin statistics retrieved successfully",
      data: {
        totalUsers,
        roleBreakdown,
        activeSessions: {
          browser: browserSessions.length,
          desktop: desktopSessions.length,
        },
        totalActiveSessions: browserSessions.length + desktopSessions.length,
      },
    });
  } catch (error) {
    logger.error(`Failed to fetch admin stats: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin statistics",
      error: error.message,
    });
  }
};

export const getAllActiveSessionsForAdmin = async (req, res) => {
  try {
    const browserSessions = getActiveSessions().map(session => ({
      ...session,
      type: "browser",
    }));
    const desktopSessions = getActiveDesktopSessions().map(session => ({
      ...session,
      type: "desktop",
    }));

    res.status(200).json({
      success: true,
      message: "Active sessions retrieved successfully",
      data: [...browserSessions, ...desktopSessions],
    });
  } catch (error) {
    logger.error(`Failed to fetch admin sessions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active sessions",
      error: error.message,
    });
  }
};

const normalizeSessionType = (type) => (type === "desktop" ? "desktop" : "browser");

export const runAdminSessionCommand = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { command, type } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Session ID is required" });
    }

    const normalizedType = normalizeSessionType(type);
    const result = await executeCommandInSession(sessionId, normalizedType, command);

    res.status(200).json({
      success: true,
      message: "Command executed successfully",
      data: {
        ...result,
        type: normalizedType,
        sessionId,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    logger.error(`Failed to execute command for admin session: ${error.message}`);
    res.status(status).json({
      success: false,
      message: error.message || "Failed to execute command",
    });
  }
};

export const getAdminSessionLogs = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, tail } = req.query;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Session ID is required" });
    }

    const normalizedType = normalizeSessionType(type);
    const tailNumber = tail ? Number.parseInt(tail, 10) : 200;
    const logs = await fetchSessionLogs(sessionId, normalizedType, tailNumber);

    res.status(200).json({
      success: true,
      message: "Logs fetched successfully",
      data: {
        ...logs,
        sessionId,
        type: normalizedType,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    logger.error(`Failed to fetch session logs for admin: ${error.message}`);
    res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch logs",
    });
  }
};

export const getAdminSessionResources = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type } = req.query;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Session ID is required" });
    }

    const normalizedType = normalizeSessionType(type);
    const snapshot = await fetchSessionResourceUsage(sessionId, normalizedType);

    res.status(200).json({
      success: true,
      message: "Resource usage fetched successfully",
      data: {
        ...snapshot,
        sessionId,
        type: normalizedType,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    logger.error(`Failed to fetch session resources for admin: ${error.message}`);
    res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch resource usage",
    });
  }
};

