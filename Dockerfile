# syntax=docker/dockerfile:1.7
#
# Shepherd Connect — one image per release, shared by every church.
# Each church runs its own `api` container with its own settings file; the
# `web` image (Caddy + the built web app) serves all churches' sites.
#
#   docker build --target api -t shepherd-connect-api .
#   docker build --target web -t shepherd-connect-web .

ARG NODE_IMAGE=node:22-bookworm-slim
ARG PNPM_VERSION=10.28.0

# ── Build everything once ────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS build
ARG PNPM_VERSION
WORKDIR /app
RUN npm install -g pnpm@${PNPM_VERSION}

# Install dependencies first so they are cached between code changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/shepherd-connect/package.json artifacts/shepherd-connect/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/db/package.json lib/db/
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/
COPY lib/object-storage-web/package.json lib/object-storage-web/
# An extra CA certificate can be supplied for builds behind a TLS-inspecting
# proxy:  docker build --secret id=extra_ca,src=/path/ca.pem ...
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    pnpm install --frozen-lockfile \
      --filter @workspace/api-server... --filter @workspace/shepherd-connect...

COPY tsconfig.base.json tsconfig.json ./
COPY lib lib
COPY artifacts/api-server artifacts/api-server
COPY artifacts/shepherd-connect artifacts/shepherd-connect
RUN pnpm --filter @workspace/api-server run build \
 && PORT=3000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/shepherd-connect run build
# A self-contained production copy of the API with only its runtime packages.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    pnpm --filter @workspace/api-server deploy --prod --legacy /out/api \
 && cp -r artifacts/api-server/dist /out/api/dist

# ── API (one container per church) ───────────────────────────────────────────
FROM ${NODE_IMAGE} AS api
# LibreOffice converts PowerPoint uploads for classroom displays. Build with
# --build-arg WITH_LIBREOFFICE=false for a much smaller image without it.
ARG WITH_LIBREOFFICE=true
RUN if [ "$WITH_LIBREOFFICE" = "true" ]; then \
      apt-get update \
      && apt-get install -y --no-install-recommends libreoffice-impress fonts-dejavu-core fonts-liberation \
      && rm -rf /var/lib/apt/lists/*; \
    fi
ENV NODE_ENV=production \
    PORT=8080 \
    TZ=UTC \
    HOME=/tmp
WORKDIR /app
COPY --from=build --chown=node:node /out/api /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Run with an init process (compose sets `init: true`) so signals reach Node
# and the WhatsApp connection closes cleanly on shutdown.
CMD ["node", "--enable-source-maps", "dist/index.mjs"]

# ── Web server: Caddy with the built web app (serves every church) ───────────
FROM caddy:2-alpine AS web
COPY --from=build /app/artifacts/shepherd-connect/dist/public /srv/web

# ── Tools: database schema updates (drizzle push) and maintenance scripts ───
FROM build AS tools
WORKDIR /app
CMD ["sh"]
