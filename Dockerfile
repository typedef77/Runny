# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN cd client && npm ci
RUN cd server && npm ci

# Copy source files
COPY client ./client
COPY server ./server

# Build client and server
RUN cd client && npm run build
RUN cd server && npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy server package files and install production dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy built assets
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/runny.db
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
