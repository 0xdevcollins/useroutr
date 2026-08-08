# Build context is the repo root — this app depends on workspace packages
# (@useroutr/ui, @useroutr/types), so the whole monorepo must be present for
# `npm ci` to resolve the workspace links.
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/checkout/package.json apps/checkout/
COPY apps/www/package.json apps/www/
COPY packages/types/package.json packages/types/
COPY packages/stellar/package.json packages/stellar/
COPY packages/ui/package.json packages/ui/
RUN npm ci

# ── Development: sources are bind-mounted for hot reload ──────────────────────
FROM deps AS dev
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3002
# `next dev` has no port baked into www's script, so pass it here.
CMD ["npm", "--workspace=www", "run", "dev", "--", "--port", "3002"]

# ── Production ────────────────────────────────────────────────────────────────
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm --workspace=www run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
COPY --from=build /app/apps/www apps/www
COPY --from=build /app/package.json package.json

WORKDIR /app/apps/www
EXPOSE 3002
CMD ["npm", "run", "start", "--", "--port", "3002"]
