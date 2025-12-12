"use strict";

import bcrypt from "bcrypt";
import logger from "./logger.js";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_NAME,
} from "../config/env.js";
import {
  createUser,
  findUserByEmail,
  USER_ROLES,
} from "../repositories/user.repository.js";

/**
 * Seed a default admin user when credentials are provided via env variables.
 * This helps bootstrapping environments without having to manually hit the sign-up route.
 */
export const seedDefaultAdmin = async () => {
  try {
    if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
      logger.info("Default admin credentials not provided, skipping admin seeding");
      return;
    }

    const existingUser = await findUserByEmail(DEFAULT_ADMIN_EMAIL);
    if (existingUser) {
      logger.info(`Default admin ${DEFAULT_ADMIN_EMAIL} already exists`);
      return;
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    const adminName = DEFAULT_ADMIN_NAME || "SafeBox Admin";

    await createUser({
      name: adminName,
      email: DEFAULT_ADMIN_EMAIL,
      password: hashedPassword,
      role: USER_ROLES.ADMIN,
    });

    logger.info(`Default admin user ${DEFAULT_ADMIN_EMAIL} created successfully`);
  } catch (error) {
    logger.error(`Failed to seed default admin user: ${error.message}`);
  }
};

export default seedDefaultAdmin;

