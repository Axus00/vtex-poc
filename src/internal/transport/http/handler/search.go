package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"

	"vtex-poc/src/internal/application/search"
)

type SearchService interface {
	Search(ctx context.Context, req search.Request) (search.Result, error)
}

type Search struct {
	service SearchService
}

func NewSearch(service SearchService) *Search {
	return &Search{service: service}
}

// GET /search?q=shirt&count=3
func (h *Search) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	count, _ := strconv.Atoi(r.URL.Query().Get("count")) // si falla queda 0 y el service pone el default
	req := search.Request{
		Query: r.URL.Query().Get("q"),
		Count: count,
	}

	result, err := h.service.Search(r.Context(), req)
	if err != nil {
		if errors.Is(err, search.ErrEmptyQuery) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		log.Printf("search: %v", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "error consultando VTEX"})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("writeJSON: %v", err)
	}
}
