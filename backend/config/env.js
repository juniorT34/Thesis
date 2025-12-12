import { config } from "dotenv";

config({
    path: `.env.${process.env.NODE_ENV || 'development'}.local`,
    quiet: true
})

export const {
    PORT, 
    NODE_ENV,
    DATABASE_URL,
    MONGODB_URI,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    MORGAN_MODE,
    ARCJET_KEY,
    ARCJET_ENV,
    CHROMIUM_BROWSER,
    CHROMIUM_BROWSER1,
    FIREFOX_BROWSER,
    EDGE_BROWSER,
    // Desktop environment variables
    UBUNTU_DESKTOP,
    DEBIAN_DESKTOP,
    FEDORA_DESKTOP,
    ALPINE_DESKTOP,
    ARCH_DESKTOP,
    DEFAULT_ADMIN_NAME,
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_EXTENSION_USER_ID,
} = process.env