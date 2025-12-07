FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY babel.config.js ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build for web (optional)
RUN npm run build:web || echo "Web build skipped"

FROM node:18-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app /app

# Install Expo CLI globally
RUN npm install -g expo-cli

# Expose ports
EXPOSE 19000 19001 19002

# Start Expo
CMD ["npx", "expo", "start", "--tunnel"]