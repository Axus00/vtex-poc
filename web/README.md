# vtex·poc — front de búsqueda

Front en **Vite + React + TypeScript** que imita el header y el buscador de un storefront
(banda amarilla, buscador grande con botón negro, menú de categorías y banner promocional).
Vive aparte de la POC en Go: no comparte código con ella, solo consume su endpoint `GET /search`.

## Qué hace

- Al escribir en el buscador (mínimo 2 caracteres) se abre un desplegable bajo el input con dos columnas:
  - **Izquierda:** "Productos para “…”" con tarjetas de producto: foto de VTEX a la izquierda y, a la
    derecha, nombre, descripción (texto plano, sin HTML), marca, precio en COP y, si hay rebaja, precio
    de lista tachado con el % de descuento. Cada tarjeta abre el producto en la tienda demo de VTEX.
    Al final: "Ver todos los resultados (total)".
  - **Derecha, arriba:** **Búsquedas relacionadas** (hasta 5), armadas en el front por
    `buildRelatedSearches(query, products)` en `src/lib/related.ts` (VTEX `search_suggestions` no devuelve
    términos para el catálogo demo). Al hacer clic en una, se llena el input y se busca de inmediato, sin
    esperar el debounce y sin cerrar el desplegable.
  - **Derecha, abajo:** una **Publicidad** compacta. Si la búsqueda nombra una marca reconocida (o, si no
    nombra ninguna, la marca del primer resultado es reconocida), se muestra el **video promocional de la
    marca**; si no, el anuncio de categoría (moda, calzado, tecnología, hogar, deportes o genérico) armado por
    `buildAd(query, products)` en `src/lib/ad.ts`.
- Debounce de 300 ms, `count=5`, cancelación de peticiones viejas con `AbortController`;
  Enter o el botón de la lupa buscan de inmediato.
- Estados: cargando (skeletons, también en las búsquedas relacionadas), sin resultados (con sugerencias y
  búsquedas relacionadas), error (mensaje del backend + reintentar; sin búsquedas relacionadas ni publicidad).
- Se cierra con `Escape` o haciendo clic fuera. En escritorio la columna derecha queda fija mientras se
  desplazan los productos; en pantallas < 768 px va debajo de los productos.

### Búsquedas relacionadas

`buildRelatedSearches` es una función pura que devuelve hasta 5 términos sin repetir y sin la query actual
(ignora mayúsculas, tildes, espacios y plural simple), en este orden:

1. hasta 2 **marcas de los resultados**, descartando marcas "basura" del catálogo como `New Offers!!`
   (`isUsefulBrand` en `src/lib/brands.ts`);
2. los **términos de la categoría** detectada, con la misma taxonomía de la publicidad (campo `searches` de
   cada regla en `src/lib/ad.ts`);
3. el resto de marcas de los resultados;
4. **búsquedas populares** del catálogo demo que sí traen resultados (`shirt`, `shoes`, `top`, `samsung`,
   `mizuno`, `sony`), útiles sobre todo cuando no hubo productos.

### Publicidad con video de marca

Las marcas reconocidas viven en `BRANDS` (`src/lib/brands.ts`): Nike, Adidas, Puma, Samsung, Apple, Sony,
Lenovo y Motorola. La marca se reconoce por **palabra completa** (sin tildes ni mayúsculas): "zapatillas nike"
→ Nike, pero "pineapple" no es Apple. Primero se mira la query y, si no nombra ninguna marca, la marca del
primer resultado (p. ej. `phone` → producto de Apple → video de Apple).

El video se inserta desde `youtube-nocookie.com`, silenciado, en bucle y sin controles; si el sistema pide
**reducir el movimiento** (`prefers-reduced-motion`) no se reproduce solo y muestra controles. Debajo van el
nombre de la marca, una frase y el enlace "Ver más" (con nombre accesible "Ver más de <marca>") a la búsqueda
de la marca en la tienda.

> El catálogo demo no tiene productos de Nike ni Adidas: al buscarlas se ve el estado vacío, las búsquedas
> populares y el video de la marca.

**Agregar una marca:**

1. Elige un video del **canal oficial** de la marca en YouTube y copia su ID (lo que va después de `watch?v=`).
2. Verifica que existe, que se puede insertar y que es del canal oficial:

   ```sh
   curl -s 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>&format=json'
   ```

   Debe responder HTTP 200 y `author_url` debe ser el canal oficial (p. ej. `https://www.youtube.com/@nike`).
   Un 401/403/404 significa que no existe o que no se puede insertar.
3. Agrega una entrada a `BRANDS` con `id`, `name`, `aliases` (palabras que nombran la marca, p. ej. `iphone`
   para Apple; evita palabras comunes), `youtubeId`, `videoTitle`, `channel`, `tagline` (en español) y
   `theme` (colores de fondo, texto y botón).
4. `npm test`: los tests de `src/lib/brands.test.ts` validan IDs, alias únicos y que el nombre encuentre la marca.

> El catálogo de demostración de VTEX está en inglés: prueba con **shirt**, **shoes** o **top**.

## Cómo correrlo

1. Desde la raíz del repo, levanta la API de Go (puerto 8080):

   ```sh
   go run ./src/cmd/api
   ```

2. En otra terminal, levanta el front:

   ```sh
   cd web
   npm install
   npm run dev
   ```

3. Abre <http://localhost:5173>.

El servidor de Vite hace de proxy: `/api/search?q=shirt` → `http://localhost:8080/search?q=shirt`,
así que no hace falta configurar CORS en Go.

### Apuntar a otra API (`API_TARGET`)

Si la API de Go corre en otro host o puerto, define `API_TARGET` al arrancar Vite:

```sh
API_TARGET=http://localhost:9090 npm run dev
```

El mismo proxy aplica a `npm run preview` (sirve el build de `dist/` en <http://localhost:4173>).

### En producción

No hay proxy: la API de Go sirve el build de `dist/` y responde `/api/search` en el **mismo origen**, así
que el front funciona sin cambios. Para probarlo en local: `npm run build` y, desde la raíz,
`go run ./src/cmd/api` (abre <http://localhost:8080>). Docker y Render: ver el [`README.md`](../README.md)
de la raíz.

## Scripts

| Script              | Qué hace                                              |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo en el puerto 5173 (con proxy). |
| `npm run build`     | Typecheck + build de producción en `dist/`.           |
| `npm run preview`   | Sirve `dist/` (con el mismo proxy).                   |
| `npm test`          | Tests con Vitest + Testing Library (jsdom).           |
| `npm run typecheck` | `tsc -b` sin emitir archivos.                         |
| `npm run check`     | `typecheck` + `test` + `build` (lo usa `./init.sh`).  |

## Estructura

```
src/
  api/search.ts             cliente tipado de GET /search (+ tipos de la respuesta de Go)
  hooks/useProductSearch.ts debounce, AbortController y descarte de respuestas fuera de orden
  hooks/usePrefersReducedMotion.ts  prefers-reduced-motion (sin autoplay del video)
  lib/ad.ts                 buildAd(query, products): publicidad de categoría + búsquedas por categoría
  lib/brands.ts             marcas con video (BRANDS), matchBrand, URL de inserción de YouTube
  lib/related.ts            buildRelatedSearches(query, products): búsquedas relacionadas
  lib/text.ts               normalización compartida (sin tildes, palabras, comparación de términos)
  lib/format.ts             stripHtml, formatPrice (es-CO / COP), descuentos
  lib/store.ts              enlaces a la tienda demo de VTEX
  components/               Header, SearchBox (desplegable), ProductCard, RelatedSearches, AdSlot, íconos
```
