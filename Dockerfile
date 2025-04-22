# Stage 1: Build React Frontend
FROM node:18-slim as build-stage
WORKDIR /app

# Copy frontend package files and install dependencies
COPY package*.json ./
COPY src ./src
COPY public ./public
COPY vite.config.js ./
COPY index.html ./


# Install all dependencies (including dev for build), ignoring peer dependency conflicts
RUN npm install --legacy-peer-deps

# Build the frontend
RUN npm run build

# Stage 2: Setup Node.js Backend Environment
FROM node:18-slim as production-stage

WORKDIR /usr/src/app

# Copy backend package files and install production dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy backend code (excluding node_modules already installed)
COPY server/ ./server/

# Copy built frontend assets from build stage
COPY --from=build-stage /app/dist ./dist

# Expose the port the app runs on (Cloud Run uses PORT env var)
# EXPOSE 8080

# Start the server
WORKDIR /usr/src/app/server
CMD ["node", "index.js"] 