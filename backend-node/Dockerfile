FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (for better caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Build step (if you have any build scripts, e.g., TypeScript, uncomment below)
# RUN npm run build

# --- Production image ---
FROM node:20-alpine
WORKDIR /app

# Copy only production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Create app user but allow Docker access
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Add appuser to docker group (if it exists) or create it
RUN addgroup -S docker 2>/dev/null || true
RUN adduser appuser docker 2>/dev/null || true

# Set permissions for Docker socket access
RUN chown -R appuser:appgroup /app

# For development, we'll run as root to access Docker socket
# In production, you should configure proper Docker group permissions
USER root

ENV NODE_ENV=production

EXPOSE 4000
CMD ["node", "server.js"] 