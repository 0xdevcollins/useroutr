# Build context is the repo root — the API depends on workspace packages
# (@useroutr/types, @useroutr/stellar), so the whole monorepo must be present
# for `npm ci` to resolve the workspace links.
FROM node:20-alpine AS deps
WORKDIR /app

# openssl is required by Prisma's query engine on alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/checkout/package.json apps/checkout/
COPY apps/www/package.json apps/www/
COPY packages/types/package.json packages/types/
COPY packages/stellar/package.json packages/stellar/
COPY packages/ui/package.json packages/ui/
RUN npm ci

# ── Development: sources are bind-mounted, so only deps + client are baked in ──
FROM deps AS dev
COPY apps/api/prisma apps/api/prisma
RUN npm --workspace=api run prisma:generate
EXPOSE 3000
CMD ["npm", "--workspace=api", "run", "start:dev"]

# ── Production ────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN npm --workspace=api run build

FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/package.json package.json

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main"]
