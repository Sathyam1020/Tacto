# Tacto worker (BullMQ consumer). Built from the repo root as context:
#   docker build -f apps/worker/Dockerfile -t tacto-worker .
# Uses ffmpeg-static + sharp — both ship prebuilt Linux binaries that install
# with `npm ci` on this Debian (glibc) base, so no apt packages are needed.
FROM node:22-bookworm-slim

WORKDIR /app

COPY . .
RUN npm ci

# Prisma client (the worker reads/writes the DB directly).
# `prisma generate` never connects, but prisma.config.ts resolves
# env("DATABASE_URL") eagerly on load — so the var must merely exist. Scoped to
# this RUN only; never reaches the runtime image. Railway injects the real one.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    npm run db:generate -w @workspace/db

ENV NODE_ENV=production

# Background worker — no port to expose.
CMD ["npm", "run", "start:prod", "-w", "apps/worker"]
