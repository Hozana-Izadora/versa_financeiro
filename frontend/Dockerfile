# ─── Stage 1: build the React/Vite app ───────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# VITE_TENANT_ID must be known at build time because Vite bakes env vars
# into the JS bundle during compilation.
# Pass it via: docker-compose build --build-arg VITE_TENANT_ID=<uuid>
# or define it in .env (docker-compose picks it up automatically).
ARG VITE_TENANT_ID
ENV VITE_TENANT_ID=$VITE_TENANT_ID

RUN npm run build


# ─── Stage 2: nginx runtime ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove the default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy the compiled assets
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx:alpine already drops to the "nginx" user for worker processes.
# The master process needs to stay as root to bind port 80.
# For extra hardening on servers where you control the port mapping,
# you can switch to port 8080 and run fully unprivileged.

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health 2>/dev/null || \
      wget -qO- http://localhost/ > /dev/null 2>&1 && exit 0 || exit 1

CMD ["nginx", "-g", "daemon off;"]
