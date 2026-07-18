# Tacto API (Express). Built from the repo root as context:
#   docker build -f apps/api/Dockerfile -t tacto-api .
# The app runs TypeScript directly via tsx (a devDependency), so we install the
# full dependency graph — do NOT prune dev deps.
FROM node:22-bookworm-slim

WORKDIR /app

# Install the whole workspace from the lockfile (deterministic).
COPY . .
RUN npm ci

# Generate the Prisma client into packages/db/src/generated.
# `prisma generate` never connects to the DB, but prisma.config.ts resolves
# env("DATABASE_URL") eagerly on load — so the var must merely exist. This
# throwaway value is scoped to this RUN only and never reaches the runtime
# image; Railway injects the real DATABASE_URL at run time.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    npm run db:generate -w @workspace/db

# Runtime is production; install already happened above with dev deps present.
ENV NODE_ENV=production
# Railway/host injects PORT; the API reads process.env.PORT.
EXPOSE 4100

CMD ["npm", "run", "start:prod", "-w", "apps/api"]
