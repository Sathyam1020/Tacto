# Tacto worker (BullMQ consumer). Built from the repo root as context:
#   docker build -f apps/worker/Dockerfile -t tacto-worker .
# Uses ffmpeg-static + sharp — both ship prebuilt Linux binaries that install
# with `npm ci` on this Debian (glibc) base, so no apt packages are needed.
FROM node:22-bookworm-slim

WORKDIR /app

COPY . .
RUN npm ci

# Prisma client (the worker reads/writes the DB directly).
RUN npm run db:generate -w @workspace/db

ENV NODE_ENV=production

# Background worker — no port to expose.
CMD ["npm", "run", "start:prod", "-w", "apps/worker"]
