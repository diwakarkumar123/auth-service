# -------- Stage 1: Build --------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# -------- Stage 2: Production --------
FROM node:20-alpine

WORKDIR /app

# Copy only necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Security: non-root user
USER node

EXPOSE 5000

CMD ["node", "dist/index.js"]