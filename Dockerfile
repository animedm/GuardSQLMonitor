# Backend Dockerfile
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy backend package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy backend source
COPY src ./src

# Build backend
RUN npm run build

# Production stage
FROM node:20-alpine AS backend

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built files from builder
COPY --from=backend-builder /app/dist ./dist

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/server.js"]
