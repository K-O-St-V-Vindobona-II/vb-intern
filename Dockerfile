FROM docker.io/library/node:22-slim AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_APP_ENVIRONMENT=production
ARG VITE_API_BASE_URL=""
ENV VITE_APP_ENVIRONMENT=$VITE_APP_ENVIRONMENT
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


FROM docker.io/library/nginx:1-alpine

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["wget", "-qO-", "http://127.0.0.1/"]
