# Node 22 is supported by Medusa and by the frontend's build-time dependencies.
# Pinning both images to the same multi-architecture release keeps Mac and Linux
# deployments reproducible.
FROM node:22.22.0-bookworm-slim AS dependencies

WORKDIR /server
ENV npm_config_update_notifier=false

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --ignore-scripts

FROM dependencies AS development
COPY . .

FROM development AS build
RUN npm run build

# Keep dependency installation in a content-addressed layer. Source-only
# changes rebuild Medusa, but reuse this layer while the generated lockfile is
# unchanged.
FROM node:22.22.0-bookworm-slim AS production-dependencies

WORKDIR /runtime
ENV npm_config_update_notifier=false

COPY --from=build /server/apps/backend/.medusa/server/package.json ./
# The Medusa CLI currently loads ts-node during startup even for compiled
# production output, so retain the generated server's complete toolchain.
RUN npm install --ignore-scripts

FROM node:22.22.0-bookworm-slim AS production

WORKDIR /server/apps/backend/.medusa/server
ENV NODE_ENV=production
ENV npm_config_update_notifier=false

COPY --from=build /server/apps/backend/.medusa/server ./
COPY --from=production-dependencies /runtime/node_modules ./node_modules
COPY docker/start-production.sh /server/docker/start-production.sh
RUN chmod +x /server/docker/start-production.sh

EXPOSE 9000
CMD ["npm", "start"]
