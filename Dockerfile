# Use LTS Node for stability
FROM node:20-alpine

# Create app dir
WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

# Environment (set at runtime on Railway)
ENV NODE_ENV=production

# Start
CMD ["node", "dist/index.js"]
