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

# Build TypeScript to JavaScript using esbuild (super fast)
RUN pnpm build:fast

# Debug: Show what was built
RUN echo "=== Build output ===" && ls -la dist/

# Expose port
EXPOSE 8000

# Start server - use compiled bundle (super fast startup)
CMD ["pnpm", "start:server"]
