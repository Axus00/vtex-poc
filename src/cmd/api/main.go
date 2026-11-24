package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"vtex-poc/src/internal/application/search"
	"vtex-poc/src/internal/transport/http/handler"
	"vtex-poc/src/internal/transport/http/web"
	"vtex-poc/src/internal/vtex"
)

const (
	defaultPort      = "8080"
	defaultStaticDir = "web/dist"
	shutdownTimeout  = 10 * time.Second
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	vtexClient := vtex.NewClient("https://storecomponents.vtexcommercestable.com.br", 10*time.Second)
	searchService := search.NewService(vtexClient)
	searchHandler := handler.NewSearch(searchService)

	static, dir, err := openStatic(os.Getenv)
	switch {
	case err != nil:
		log.Printf("front: %v; solo API", err)
	case static == nil:
		log.Printf("front: no existe %s; solo API (compila el front con: cd web && npm run build)", dir)
	default:
		defer static.Close()
		log.Printf("front: sirviendo %s", dir)
	}

	var staticHandler http.Handler
	if static != nil {
		staticHandler = static
	}

	ln, err := net.Listen("tcp", listenAddr(os.Getenv))
	if err != nil {
		log.Fatal(err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	log.Printf("escuchando en el puerto %d (http://localhost:%d)", port, port)

	if err := serve(ctx, ln, newRouter(searchHandler, staticHandler)); err != nil {
		log.Fatal(err)
	}
	log.Println("servidor detenido")
}

// listenAddr arma la dirección de escucha a partir de PORT (Render la define);
// sin PORT usa 8080.
func listenAddr(getenv func(string) string) string {
	port := getenv("PORT")
	if port == "" {
		port = defaultPort
	}
	return ":" + port
}

// openStatic abre el directorio del front: STATIC_DIR o, si no está definida,
// web/dist. Si el directorio no existe devuelve (nil, dir, nil) y la API
// funciona sola; si existe pero no sirve (p. ej. sin index.html), devuelve error.
func openStatic(getenv func(string) string) (*web.Handler, string, error) {
	dir := getenv("STATIC_DIR")
	if dir == "" {
		dir = defaultStaticDir
	}
	if _, err := os.Stat(dir); errors.Is(err, os.ErrNotExist) {
		return nil, dir, nil
	}
	h, err := web.New(dir)
	if err != nil {
		return nil, dir, err
	}
	return h, dir, nil
}

// newRouter registra las rutas de la API y, si static no es nil, el front en "/".
//   - GET /search:     búsqueda (la usa el proxy de Vite en desarrollo, que quita /api).
//   - GET /api/search: la misma búsqueda, para el front servido por Go (mismo origen).
//   - GET /healthz:    health check de Render.
func newRouter(search http.Handler, static http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /search", search) // patrones con método: Go 1.22+
	mux.Handle("GET /api/search", search)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte("ok\n"))
	})
	if static != nil {
		mux.Handle("GET /", static)
	}
	return mux
}

// serve atiende en ln hasta que ctx se cancela (SIGINT/SIGTERM) y entonces
// cierra con srv.Shutdown, esperando como máximo shutdownTimeout.
func serve(ctx context.Context, ln net.Listener, h http.Handler) error {
	srv := &http.Server{
		Handler:           h,
		ReadHeaderTimeout: 5 * time.Second,
	}

	errc := make(chan error, 1)
	go func() { errc <- srv.Serve(ln) }()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}

	log.Println("apagando: esperando peticiones en curso")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-errc; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
