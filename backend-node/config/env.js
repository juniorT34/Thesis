import { config } from "dotenv";

config({
    path: `.env.${process.env.NODE_ENV || 'development'}.local`,
    quiet: true
})

export const {
    PORT, 
    NODE_ENV,
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
    ARCH_DESKTOP
} = process.env