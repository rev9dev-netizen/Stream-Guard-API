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

# Expose port
EXPOSE 8000

# Use vite-node for deployment (works on free tier)
# Accepts 30s startup time but runs reliably
CMD ["pnpm", "start:server:dev"]
