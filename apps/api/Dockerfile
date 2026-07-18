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
RUN npm run db:generate -w @workspace/db

# Runtime is production; install already happened above with dev deps present.
ENV NODE_ENV=production
# Railway/host injects PORT; the API reads process.env.PORT.
EXPOSE 4100

CMD ["npm", "run", "start:prod", "-w", "apps/api"]
