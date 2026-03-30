FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production + dev deps (need tsc to compile)
RUN npm ci

# Copy source + public
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

# Compile TypeScript
RUN npx tsc

# Remove dev deps to slim image
RUN npm prune --production

# Cloud Run needs PORT
ENV PORT=8080
EXPOSE 8080

# Start the compiled server
CMD ["node", "dist/server.js"]
