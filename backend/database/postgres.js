import { Pool } from "pg";
import { DATABASE_URL, NODE_ENV } from "../config/env.js";
import logger from "../utils/logger.js";

const USERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const SESSIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  target_url TEXT,
  entry_url TEXT,
  container_id TEXT,
  flavor VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_status_idx ON sessions (status);
`;

let pool;
let pgMemInstance = null;

if (NODE_ENV === "test") {
  const { newDb } = await import("pg-mem");
  pgMemInstance = newDb({ autoCreateForeignKeyIndices: true });
  const pgMemPg = pgMemInstance.adapters.createPg();
  pool = new pgMemPg.Pool();

  pgMemInstance.public.none(USERS_TABLE_SQL);
  logger.info("Initialized in-memory PostgreSQL database for tests");
} else {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required for PostgreSQL connection");
  }

  const parsed = new URL(DATABASE_URL);
  const localHosts = new Set(["localhost", "127.0.0.1", "host.docker.internal"]);
  const useSSL = !localHosts.has(parsed.hostname.toLowerCase());

  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
  });
}

export const initializeDatabase = async () => {
  if (NODE_ENV === "test") {
    return;
  }

  try {
    await pool.query(USERS_TABLE_SQL);
    await pool.query(SESSIONS_TABLE_SQL);
    logger.info("PostgreSQL schema ensured successfully");
  } catch (error) {
    logger.error("Failed to initialize PostgreSQL schema:", error);
    throw error;
  }
};

export const query = (text, params = []) => pool.query(text, params);

export const closeDatabase = async () => {
  await pool.end();
};

export const resetTestDatabase = async () => {
  if (NODE_ENV === "test" && pgMemInstance) {
    pgMemInstance.public.none("TRUNCATE TABLE users;");
  }
};

export default {
  initializeDatabase,
  closeDatabase,
  query,
  resetTestDatabase,
};

