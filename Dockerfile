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

# Start server - use production build
CMD ["pnpm", "start:server"]
