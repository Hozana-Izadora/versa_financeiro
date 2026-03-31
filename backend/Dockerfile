# ─── Stage 1: install production dependencies ───────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
# ci installs exact locked versions; omit=dev skips devDependencies
RUN npm ci --omit=dev


# ─── Stage 2: runtime image ──────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# The official node:alpine image ships a non-root "node" user (uid 1000).
# We use it directly — no need to create a custom user.
WORKDIR /app

# Copy only what the server needs to run
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node src        ./src
COPY --chown=node:node scripts    ./scripts
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node package.json ./

USER node

EXPOSE 3001

# Healthcheck relies on the /health endpoint defined in index.js
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/index.js"]
