# syntax=docker/dockerfile:1

# Imagen única para Render: compila el front (Vite) y la API (Go), y entrega
# un binario estático que sirve ambos desde el mismo origen.

# --- 1. Front: web/dist -------------------------------------------------------
# El build es JS puro: corre en la plataforma del builder aunque el destino sea otra.
FROM --platform=$BUILDPLATFORM node:24.19.0-slim AS web
WORKDIR /web
# Primero solo los manifiestos: la capa de npm ci se reutiliza si no cambian.
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# --- 2. API: binario estático de Go ---------------------------------------------
FROM --platform=$BUILDPLATFORM golang:1.27.4-alpine AS api
# go.mod pide go 1.27.3: con 1.27.4 no hace falta descargar otro toolchain.
ENV GOTOOLCHAIN=local CGO_ENABLED=0
ARG TARGETOS=linux
ARG TARGETARCH=amd64
WORKDIR /src
# Sin dependencias externas: no hay go.sum.
COPY go.mod ./
COPY src/ ./src/
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/api ./src/cmd/api

# --- 3. Imagen final: distroless, sin shell y sin root --------------------------
# static-debian12 incluye certificados CA (la API llama a VTEX por HTTPS).
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=api /out/api /app/api
COPY --from=web /web/dist /app/web
ENV STATIC_DIR=/app/web
# Render define PORT; sin PORT la API escucha en 8080.
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/api"]
