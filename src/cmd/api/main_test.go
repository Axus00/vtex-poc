package main

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"vtex-poc/src/internal/application/search"
	"vtex-poc/src/internal/transport/http/handler"
)

func env(vars map[string]string) func(string) string {
	return func(k string) string { return vars[k] }
}

func TestListenAddr(t *testing.T) {
	if got := listenAddr(env(nil)); got != ":8080" {
		t.Fatalf("sin PORT: %q, quiero :8080", got)
	}
	if got := listenAddr(env(map[string]string{"PORT": "10000"})); got != ":10000" {
		t.Fatalf("PORT=10000: %q, quiero :10000", got)
	}
}

// fakeService responde siempre lo mismo y guarda la última petición.
type fakeService struct {
	got search.Request
}

func (f *fakeService) Search(_ context.Context, req search.Request) (search.Result, error) {
	f.got = req
	if req.Query == "" {
		return search.Result{}, search.ErrEmptyQuery
	}
	return search.Result{
		Total: 1,
		Products: []search.Product{{
			ID: "1", Name: "Camisa <b>", Link: "https://x/p", Image: "https://x/i.jpg",
			Description: "desc & más", Brand: "Marca", Price: 10.5, ListPrice: 12,
		}},
	}, nil
}

func do(t *testing.T, h http.Handler, method, target string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestRouter_SearchRoutesAreIdentical(t *testing.T) {
	svc := &fakeService{}
	router := newRouter(handler.NewSearch(svc), nil)

	for _, q := range []string{"?q=shirt&count=3", "?q="} {
		legacy := do(t, router, http.MethodGet, "/search"+q)
		gotLegacy := svc.got
		api := do(t, router, http.MethodGet, "/api/search"+q)

		if svc.got != gotLegacy {
			t.Fatalf("%s: peticiones distintas: %+v vs %+v", q, gotLegacy, svc.got)
		}
		if legacy.Code != api.Code {
			t.Fatalf("%s: status %d vs %d", q, legacy.Code, api.Code)
		}
		if legacy.Body.String() != api.Body.String() {
			t.Fatalf("%s: cuerpos distintos:\n%s\n%s", q, legacy.Body, api.Body)
		}
		if a, b := legacy.Header().Get("Content-Type"), api.Header().Get("Content-Type"); a != b || a != "application/json" {
			t.Fatalf("%s: Content-Type %q vs %q", q, a, b)
		}
	}
	if svc.got.Query != "" {
		t.Fatalf("última query = %q", svc.got.Query)
	}

	rec := do(t, router, http.MethodGet, "/api/search?q=shirt&count=3")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"total":1`) {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}
	if svc.got != (search.Request{Query: "shirt", Count: 3}) {
		t.Fatalf("petición = %+v", svc.got)
	}
}

// pathRecorder es un handler falso que anota la ruta que le llegó.
type pathRecorder struct{ paths []string }

func (p *pathRecorder) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p.paths = append(p.paths, r.URL.Path)
	w.WriteHeader(http.StatusTeapot)
}

func TestRouter_SearchReachesHandler(t *testing.T) {
	fake := &pathRecorder{}
	router := newRouter(fake, nil)
	for _, p := range []string{"/search?q=a", "/api/search?q=a"} {
		if rec := do(t, router, http.MethodGet, p); rec.Code != http.StatusTeapot {
			t.Fatalf("%s: status = %d, no llegó al handler", p, rec.Code)
		}
	}
	if len(fake.paths) != 2 {
		t.Fatalf("llamadas = %v", fake.paths)
	}
	if rec := do(t, router, http.MethodPost, "/api/search"); rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST /api/search: status = %d, quiero 405", rec.Code)
	}
}

func TestRouter_Healthz(t *testing.T) {
	for _, static := range []http.Handler{nil, &pathRecorder{}} {
		rec := do(t, newRouter(&pathRecorder{}, static), http.MethodGet, "/healthz")
		if rec.Code != http.StatusOK || rec.Body.String() != "ok\n" {
			t.Fatalf("status = %d body = %q", rec.Code, rec.Body)
		}
	}
}

// newDist crea <tmp>/dist con un front mínimo y <tmp>/secret.txt fuera de él.
func newDist(t *testing.T) string {
	t.Helper()
	base := t.TempDir()
	dist := filepath.Join(base, "dist")
	files := map[string]string{
		filepath.Join(dist, "index.html"):             "<html>INDEX</html>",
		filepath.Join(dist, "assets", "app.js"):       "APPJS",
		filepath.Join(base, "secret.txt"):             "SECRETO",
		filepath.Join(base, "dist-sibling", "go.mod"): "module filtrado",
	}
	for name, body := range files {
		if err := os.MkdirAll(filepath.Dir(name), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(name, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dist
}

func newFullRouter(t *testing.T, dist string) (http.Handler, *pathRecorder) {
	t.Helper()
	static, _, err := openStatic(env(map[string]string{"STATIC_DIR": dist}))
	if err != nil || static == nil {
		t.Fatalf("openStatic: %v %v", static, err)
	}
	t.Cleanup(func() { static.Close() })
	fake := &pathRecorder{}
	return newRouter(fake, static), fake
}

func TestRouter_Static(t *testing.T) {
	router, fake := newFullRouter(t, newDist(t))

	cases := []struct {
		path, wantBody, wantCache string
		wantCode                  int
	}{
		{"/", "<html>INDEX</html>", "no-cache", 200},
		{"/assets/app.js", "APPJS", "public, max-age=31536000, immutable", 200},
		{"/foo/bar", "<html>INDEX</html>", "no-cache", 200},
		{"/api/nope", "", "", 404},
		{"/assets/x.js", "", "", 404},
	}
	for _, c := range cases {
		rec := do(t, router, http.MethodGet, c.path)
		if rec.Code != c.wantCode {
			t.Fatalf("%s: status = %d, quiero %d", c.path, rec.Code, c.wantCode)
		}
		if c.wantBody != "" && rec.Body.String() != c.wantBody {
			t.Fatalf("%s: body = %q", c.path, rec.Body)
		}
		if c.wantCode == 404 && strings.Contains(rec.Body.String(), "INDEX") {
			t.Fatalf("%s: devolvió index.html en vez de 404", c.path)
		}
		if got := rec.Header().Get("Cache-Control"); got != c.wantCache {
			t.Fatalf("%s: Cache-Control = %q, quiero %q", c.path, got, c.wantCache)
		}
	}

	// Las rutas de API ganan al front.
	if rec := do(t, router, http.MethodGet, "/api/search?q=x"); rec.Code != http.StatusTeapot {
		t.Fatalf("/api/search con front: status = %d", rec.Code)
	}
	if len(fake.paths) != 1 {
		t.Fatalf("llamadas al handler de búsqueda = %v", fake.paths)
	}
}

// TestRouter_TraversalOverHTTP usa un servidor real y rutas crudas (sin que el
// cliente las normalice) para comprobar que nada sale de STATIC_DIR.
func TestRouter_TraversalOverHTTP(t *testing.T) {
	router, _ := newFullRouter(t, newDist(t))
	srv := httptest.NewServer(router)
	defer srv.Close()

	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	for _, p := range []string{
		"/../secret.txt",
		"/../../secret.txt",
		"/%2e%2e/secret.txt",
		"/%2e%2e%2fsecret.txt",
		"/assets/%2e%2e/%2e%2e/secret.txt",
		"/..%2fdist-sibling/go.mod",
		"/../go.mod",
		"/%2e%2e/go.mod",
	} {
		body := rawGet(t, client, srv.URL, p)
		if strings.Contains(body, "SECRETO") || strings.Contains(body, "module") {
			t.Fatalf("%s: se filtró un archivo fuera de STATIC_DIR: %q", p, body)
		}
	}
}

// rawGet envía la ruta tal cual (Opaque evita que net/url la reescriba).
func rawGet(t *testing.T, client *http.Client, base, rawPath string) string {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, base, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.URL.Opaque = rawPath
	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("%s: %v", rawPath, err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return string(b)
}

func TestOpenStatic_MissingDirIsAPIOnly(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "no-existe")
	static, dir, err := openStatic(env(map[string]string{"STATIC_DIR": missing}))
	if err != nil || static != nil || dir != missing {
		t.Fatalf("openStatic = %v, %q, %v; quiero nil, %q, nil", static, dir, err, missing)
	}

	router := newRouter(&pathRecorder{}, nil)
	if rec := do(t, router, http.MethodGet, "/"); rec.Code != http.StatusNotFound {
		t.Fatalf("/ sin front: status = %d, quiero 404", rec.Code)
	}
	if rec := do(t, router, http.MethodGet, "/search?q=a"); rec.Code != http.StatusTeapot {
		t.Fatalf("/search sin front: status = %d", rec.Code)
	}
}

func TestOpenStatic_DefaultDir(t *testing.T) {
	// Desde src/cmd/api, "web/dist" no existe: la API arranca sola.
	static, dir, err := openStatic(env(nil))
	if err != nil || static != nil || dir != "web/dist" {
		t.Fatalf("openStatic = %v, %q, %v", static, dir, err)
	}
}

func TestOpenStatic_DirWithoutIndexIsError(t *testing.T) {
	static, _, err := openStatic(env(map[string]string{"STATIC_DIR": t.TempDir()}))
	if err == nil || static != nil {
		t.Fatalf("openStatic sin index.html = %v, %v; quiero error", static, err)
	}
}

func TestServe_GracefulShutdown(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- serve(ctx, ln, newRouter(&pathRecorder{}, nil)) }()

	res, err := http.Get("http://" + ln.Addr().String() + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("/healthz: %d", res.StatusCode)
	}

	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("serve: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("serve no terminó tras cancelar el contexto")
	}
}
