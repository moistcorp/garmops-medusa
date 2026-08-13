# Medusa supports Node.js 20.19.0+ and 22.12.0+. Node 20 is used here for
# a stable, multi-architecture (arm64/amd64) runtime.
FROM node:20.19.0-bookworm-slim AS dependencies

WORKDIR /server
ENV npm_config_update_notifier=false

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --ignore-scripts

FROM dependencies AS development
COPY . .

FROM development AS build
RUN npm run build
# The Medusa CLI currently loads ts-node during startup even for compiled
# production output, so keep the scaffold's runtime toolchain in this image.
RUN cd apps/backend/.medusa/server && npm install --ignore-scripts

FROM node:20.19.0-bookworm-slim AS production

WORKDIR /server/apps/backend/.medusa/server
ENV NODE_ENV=production
ENV npm_config_update_notifier=false

COPY --from=build /server/apps/backend/.medusa/server ./
COPY docker/start-production.sh /server/docker/start-production.sh
RUN chmod +x /server/docker/start-production.sh

EXPOSE 9000
CMD ["npm", "start"]
