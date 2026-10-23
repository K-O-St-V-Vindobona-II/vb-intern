FROM docker.io/library/node:25-slim AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Satisfies vite.env-check.ts's validateViteEnv() during `npm run build`
# below — this is a Docker-build-time-only gate, unrelated to the runtime
# APP_ENVIRONMENT env var consumed by the entrypoint script in the final
# stage (docker/docker-entrypoint.d/40-generate-runtime-config.sh). The two
# are intentionally separate and are not unified.
ARG VITE_APP_ENVIRONMENT=production
ENV VITE_APP_ENVIRONMENT=$VITE_APP_ENVIRONMENT

RUN npm run build


FROM docker.io/nginxinc/nginx-unprivileged:1-alpine

# The base image already switches to the unprivileged "nginx" user (uid 101)
# before this stage's own instructions run. Back to root only for the file
# moves below, which write under /etc.
USER root

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# config.template.js reaches dist/ verbatim (Vite copies everything under
# public/ as-is) and would otherwise stay publicly reachable at
# /config.template.js forever, since the entrypoint hook below no longer
# deletes it after rendering. Move it out of the served webroot so it is
# never web-accessible - the entrypoint reads it from here instead.
RUN mkdir -p /etc/vb-intern \
    && mv /usr/share/nginx/html/config.template.js /etc/vb-intern/config.template.js

# nginx's own /docker-entrypoint.sh (the base image's ENTRYPOINT) runs every
# executable *.sh file under /docker-entrypoint.d/ before starting nginx.
# This hook renders /etc/vb-intern/config.template.js (moved above) into
# config.js from the real container environment on every container start.
COPY --chmod=755 docker/docker-entrypoint.d/40-generate-runtime-config.sh /docker-entrypoint.d/40-generate-runtime-config.sh

# Back to the base image's unprivileged user for the actual runtime. The
# master and worker processes run as this uid throughout and nginx listens
# on 8080, so the container needs no capability at all (no port below 1024
# to bind, no worker user to switch to).
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["wget", "-qO-", "http://127.0.0.1:8080/"]
