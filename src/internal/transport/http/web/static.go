// Package web sirve el build del front (web/dist) como una SPA.
package web

import (
	"errors"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
)

const (
	indexFile = "index.html"

	cacheImmutable = "public, max-age=31536000, immutable"
	cacheNoCache   = "no-cache"
)

// Handler sirve archivos estáticos de un directorio con fallback de SPA:
//   - un archivo existente se sirve tal cual;
//   - una ruta sin archivo devuelve index.html (el router del front decide);
//   - /api/* y /assets/* inexistentes devuelven 404 (nunca index.html).
//
// Los archivos se abren a través de un os.Root: ni ".." ni symlinks pueden
// salir del directorio.
type Handler struct {
	root *os.Root
	fsys fs.FS
}

// New abre dir y verifica que tenga index.html. El Handler mantiene el
// directorio abierto hasta Close.
func New(dir string) (*Handler, error) {
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, err
	}
	h := &Handler{root: root, fsys: root.FS()}
	if _, ok := h.file(indexFile); !ok {
		root.Close()
		return nil, errors.New("web: falta " + indexFile + " en " + dir)
	}
	return h, nil
}

// Close libera el directorio abierto.
func (h *Handler) Close() error {
	return h.root.Close()
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// path.Clean sobre una ruta absoluta elimina cualquier "..": el nombre
	// resultante es relativo a la raíz y válido para fs.FS.
	clean := path.Clean("/" + r.URL.Path)
	name := strings.TrimPrefix(clean, "/")

	if clean == "/api" || strings.HasPrefix(clean, "/api/") {
		http.NotFound(w, r)
		return
	}

	if name != "" && name != indexFile {
		if info, ok := h.file(name); ok {
			if strings.HasPrefix(name, "assets/") {
				w.Header().Set("Cache-Control", cacheImmutable)
			}
			h.serve(w, r, name, info)
			return
		}
		if strings.HasPrefix(name, "assets/") {
			http.NotFound(w, r)
			return
		}
	}

	info, ok := h.file(indexFile)
	if !ok {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", cacheNoCache)
	h.serve(w, r, indexFile, info)
}

// file devuelve la info de name si es un archivo regular dentro de la raíz.
func (h *Handler) file(name string) (fs.FileInfo, bool) {
	if !fs.ValidPath(name) {
		return nil, false
	}
	info, err := fs.Stat(h.fsys, name)
	if err != nil || !info.Mode().IsRegular() {
		return nil, false
	}
	return info, true
}

// serve usa http.ServeContent (no ServeFileFS) para no heredar la redirección
// de "/index.html" a "/" y para manejar Range, HEAD y If-Modified-Since.
func (h *Handler) serve(w http.ResponseWriter, r *http.Request, name string, info fs.FileInfo) {
	f, err := h.fsys.Open(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	rs, ok := f.(io.ReadSeeker)
	if !ok {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
		return
	}
	http.ServeContent(w, r, name, info.ModTime(), rs)
}
