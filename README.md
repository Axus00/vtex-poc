# vtex-poc

POC de búsqueda de productos sobre VTEX Intelligent Search:

- **API en Go** (`src/`): `GET /search?q=shirt&count=5` consulta la tienda demo de VTEX.
- **Front en Vite + React** (`web/`): buscador estilo storefront. Detalles en [`web/README.md`](web/README.md).

En producción ambos viven en **un solo servicio**: la API de Go sirve el build del front y la búsqueda
desde el mismo origen.

## Rutas

| Ruta              | Qué hace                                                                       |
| ----------------- | ------------------------------------------------------------------------------ |
| `GET /api/search` | Búsqueda (la usa el front).                                                    |
| `GET /search`     | La misma búsqueda (la usa el proxy de Vite en desarrollo).                     |
| `GET /healthz`    | Health check: `200 ok`.                                                        |
| `GET /*`          | Front (`index.html` y `assets/`); rutas desconocidas devuelven `index.html`.   |

`/api/*` desconocidas y `/assets/*` inexistentes responden 404.

## Configuración

| Variable     | Por defecto | Uso                                                                        |
| ------------ | ----------- | -------------------------------------------------------------------------- |
| `PORT`       | `8080`      | Puerto de escucha (Render lo define solo).                                 |
| `STATIC_DIR` | `web/dist`  | Carpeta del build del front. Si no existe, la API arranca sin front.       |

No hay secretos: la tienda demo de VTEX es pública.

## Desarrollo local

```sh
go run ./src/cmd/api                    # terminal 1: API en http://localhost:8080
cd web && npm install && npm run dev    # terminal 2: front en http://localhost:5173 (proxy /api -> :8080)
```

Para probar el modo producción sin Docker:

```sh
(cd web && npm run build)
go run ./src/cmd/api            # sirve web/dist en http://localhost:8080
```

Validación completa (vet, build, tests de Go y `npm run check` del front): `./init.sh`.

## Docker

El `Dockerfile` de la raíz compila el front (Node 24), la API (Go 1.27, binario estático) y entrega una
imagen distroless que corre sin root.

```sh
docker build -t vtex-poc .
docker run --rm -p 8080:8080 vtex-poc                     # http://localhost:8080
docker run --rm -p 10000:10000 -e PORT=10000 vtex-poc     # como en Render
```

## Despliegue en Render

**Opción A — Blueprint (`render.yaml`):** en el Dashboard, **New → Blueprint**, elige el repositorio de
GitHub y confirma. Se crea el servicio web `vtex-poc` (plan free, runtime Docker, health check
`/healthz`, auto-deploy en cada push).

**Opción B — Manual:** **New → Web Service**, elige el repositorio y configura:

- Language / Runtime: **Docker**
- Dockerfile path: `./Dockerfile` · Docker context: `.`
- Instance type: **Free**
- Health check path: `/healthz`

No hace falta definir `PORT` ni otras variables. En el plan free el servicio se duerme tras un rato sin
tráfico: la primera petición después tarda unos segundos.
