FROM node:20-slim

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN pnpm run build

# Debug: Show what was built
RUN echo "=== Build output ===" && ls -R lib/

# Expose port
EXPOSE 3000

# Start server - use vite-node to handle TypeScript path aliases
# This is more reliable than trying to compile with tsc-alias
CMD ["pnpm", "start:server:dev"]
