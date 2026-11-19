# Phase 1+ runtime — single container + Mongo volume.
#
# Hardened in the production pass (§7.1): pins the base image by tag per stage,
# runs as the unprivileged `node` user, and keeps the build layer separate so the
# runtime image carries no toolchain.
FROM node:22.19-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22.19-alpine
WORKDIR /app
ENV NODE_ENV=production

# The `node` user ships with the base image; running as root means a container
# escape is a host escape, and it is a one-word fix.
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/config ./config
COPY --from=build --chown=node:node /app/kb ./kb
COPY --from=build --chown=node:node /app/offline ./offline
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/api/v1/healthz || exit 1
# SIGTERM must reach node directly, so use exec form (it does) and give the app
# time to drain: terminationGracePeriodSeconds should exceed the longest route.
STOPSIGNAL SIGTERM
CMD ["node", "dist/main"]
