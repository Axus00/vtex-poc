package web

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	indexBody  = "<!doctype html><title>spa</title>"
	assetBody  = "console.log('app')"
	secretBody = "NO-DEBE-SALIR"
)

// newSite crea <tmp>/dist con index.html, assets/app.js y favicon.svg, y un
// archivo hermano <tmp>/outside.txt que nunca debe servirse.
func newSite(t *testing.T) (dist string) {
	t.Helper()
	base := t.TempDir()
	dist = filepath.Join(base, "dist")
	mustWrite(t, filepath.Join(dist, "index.html"), indexBody)
	mustWrite(t, filepath.Join(dist, "assets", "app.js"), assetBody)
	mustWrite(t, filepath.Join(dist, "favicon.svg"), "<svg/>")
	mustWrite(t, filepath.Join(base, "outside.txt"), secretBody)
	return dist
}

func mustWrite(t *testing.T, name, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(name), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(name, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func newHandler(t *testing.T, dir string) *Handler {
	t.Helper()
	h, err := New(dir)
	if err != nil {
		t.Fatalf("New(%q): %v", dir, err)
	}
	t.Cleanup(func() { h.Close() })
	return h
}

// get llama al handler directamente (sin ServeMux), así la ruta llega sin
// limpiar y se prueba la defensa propia del handler.
func get(h http.Handler, rawPath string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "http://example.test/", nil)
	req.URL.Path = rawPath
	req.URL.RawPath = ""
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHandler_RootServesIndexWithNoCache(t *testing.T) {
	h := newHandler(t, newSite(t))
	for _, p := range []string{"/", "/index.html"} {
		rec := get(h, p)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status = %d, quiero 200", p, rec.Code)
		}
		if rec.Body.String() != indexBody {
			t.Fatalf("%s: body = %q, quiero index", p, rec.Body.String())
		}
		if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
			t.Fatalf("%s: Cache-Control = %q, quiero no-cache", p, got)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
			t.Fatalf("%s: Content-Type = %q, quiero text/html", p, ct)
		}
	}
}

func TestHandler_AssetIsImmutable(t *testing.T) {
	h := newHandler(t, newSite(t))
	rec := get(h, "/assets/app.js")
	if rec.Code != http.StatusOK || rec.Body.String() != assetBody {
		t.Fatalf("status = %d body = %q", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=31536000, immutable" {
		t.Fatalf("Cache-Control = %q", got)
	}
}

func TestHandler_OtherFileHasNoImmutableCache(t *testing.T) {
	h := newHandler(t, newSite(t))
	rec := get(h, "/favicon.svg")
	if rec.Code != http.StatusOK || rec.Body.String() != "<svg/>" {
		t.Fatalf("status = %d body = %q", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Cache-Control"); got != "" {
		t.Fatalf("Cache-Control = %q, quiero vacío", got)
	}
}

func TestHandler_SPAFallback(t *testing.T) {
	h := newHandler(t, newSite(t))
	for _, p := range []string{"/foo/bar", "/producto/123", "/assets", "/apiary"} {
		rec := get(h, p)
		if rec.Code != http.StatusOK || rec.Body.String() != indexBody {
			t.Fatalf("%s: status = %d body = %q, quiero index", p, rec.Code, rec.Body.String())
		}
		if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
			t.Fatalf("%s: Cache-Control = %q", p, got)
		}
	}
}

func TestHandler_NotFoundWithoutFallback(t *testing.T) {
	h := newHandler(t, newSite(t))
	for _, p := range []string{"/api", "/api/nope", "/api/search/extra", "/assets/x.js", "/assets/sub/y.css"} {
		rec := get(h, p)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("%s: status = %d, quiero 404", p, rec.Code)
		}
		if strings.Contains(rec.Body.String(), indexBody) {
			t.Fatalf("%s: devolvió index.html", p)
		}
	}
}

func TestHandler_TraversalNeverEscapes(t *testing.T) {
	h := newHandler(t, newSite(t))
	for _, p := range []string{
		"/../outside.txt",
		"/../../outside.txt",
		"/assets/../../outside.txt",
		"..",
		"../outside.txt",
		"/%2e%2e/outside.txt", // por si llega sin decodificar
	} {
		rec := get(h, p)
		if strings.Contains(rec.Body.String(), secretBody) {
			t.Fatalf("%s: se filtró un archivo fuera del directorio", p)
		}
	}
}

func TestHandler_SymlinkOutsideRootIsNotServed(t *testing.T) {
	dist := newSite(t)
	outside := filepath.Join(filepath.Dir(dist), "outside.txt")
	if err := os.Symlink(outside, filepath.Join(dist, "leak.txt")); err != nil {
		t.Skipf("symlink no soportado: %v", err)
	}
	h := newHandler(t, dist)
	rec := get(h, "/leak.txt")
	if strings.Contains(rec.Body.String(), secretBody) {
		t.Fatal("el symlink permitió salir del directorio")
	}
}

func TestHandler_Head(t *testing.T) {
	h := newHandler(t, newSite(t))
	req := httptest.NewRequest(http.MethodHead, "/assets/app.js", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Body.Len() != 0 {
		t.Fatalf("HEAD: status = %d body = %d bytes", rec.Code, rec.Body.Len())
	}
}

func TestNew_Errors(t *testing.T) {
	if _, err := New(filepath.Join(t.TempDir(), "no-existe")); err == nil {
		t.Fatal("New con directorio inexistente: quiero error")
	}
	empty := t.TempDir()
	if _, err := New(empty); err == nil {
		t.Fatal("New sin index.html: quiero error")
	}
}
