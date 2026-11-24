package handler_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"vtex-poc/src/internal/application/search"
	"vtex-poc/src/internal/transport/http/handler"
)

// fakeService imita al service de búsqueda y guarda el último request
type fakeService struct {
	result search.Result
	err    error

	lastReq search.Request
}

func (f *fakeService) Search(_ context.Context, req search.Request) (search.Result, error) {
	f.lastReq = req
	if req.Query == "" {
		return search.Result{}, search.ErrEmptyQuery
	}
	return f.result, f.err
}

func serve(t *testing.T, h http.Handler, target string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
	return rec
}

func decodeBody[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.NewDecoder(rec.Body).Decode(&v); err != nil {
		t.Fatalf("decodificando body: %v", err)
	}
	return v
}

func TestSearchHandler_OK(t *testing.T) {
	svc := &fakeService{result: search.Result{
		Total: 7,
		Products: []search.Product{{
			ID:          "1",
			Name:        "Work Shirt",
			Link:        "/working-shirt/p",
			Image:       "https://example.com/work-shirt.jpg",
			Description: "Wanna look awesome?",
			Brand:       "New Offers!!",
			Price:       45,
			ListPrice:   60,
		}},
	}}

	rec := serve(t, handler.NewSearch(svc), "/search?q=work+shirt&count=3")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	if svc.lastReq.Query != "work shirt" || svc.lastReq.Count != 3 {
		t.Errorf("request al service = %+v, want {Query:work shirt Count:3}", svc.lastReq)
	}

	// se valida el contrato JSON que consume el front (nombres de campos)
	body := decodeBody[map[string]any](t, rec)
	if body["total"] != float64(7) {
		t.Errorf("total = %v, want 7", body["total"])
	}
	products, ok := body["products"].([]any)
	if !ok || len(products) != 1 {
		t.Fatalf("products = %v, want 1 producto", body["products"])
	}
	p := products[0].(map[string]any)
	want := map[string]any{
		"id":          "1",
		"name":        "Work Shirt",
		"link":        "/working-shirt/p",
		"image":       "https://example.com/work-shirt.jpg",
		"description": "Wanna look awesome?",
		"brand":       "New Offers!!",
		"price":       float64(45),
		"listPrice":   float64(60),
	}
	for k, v := range want {
		if p[k] != v {
			t.Errorf("products[0].%s = %v, want %v", k, p[k], v)
		}
	}
}

func TestSearchHandler_InvalidCountFallsBackToZero(t *testing.T) {
	svc := &fakeService{}

	rec := serve(t, handler.NewSearch(svc), "/search?q=shirt&count=abc")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	// el handler deja count en 0 y el service aplica el default
	if svc.lastReq.Count != 0 {
		t.Errorf("Count = %d, want 0", svc.lastReq.Count)
	}
}

func TestSearchHandler_EmptyQuery(t *testing.T) {
	rec := serve(t, handler.NewSearch(&fakeService{}), "/search?q=")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	body := decodeBody[map[string]string](t, rec)
	if body["error"] != search.ErrEmptyQuery.Error() {
		t.Errorf("error = %q, want %q", body["error"], search.ErrEmptyQuery.Error())
	}
}

func TestSearchHandler_ServiceError(t *testing.T) {
	// silenciamos el log.Printf del handler durante el test
	prev := log.Writer()
	log.SetOutput(io.Discard)
	t.Cleanup(func() { log.SetOutput(prev) })

	svc := &fakeService{err: errors.New("vtex: status 503: detalle interno")}
	rec := serve(t, handler.NewSearch(svc), "/search?q=shirt")

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
	body := decodeBody[map[string]string](t, rec)
	if body["error"] != "error consultando VTEX" {
		t.Errorf("error = %q, want %q", body["error"], "error consultando VTEX")
	}
	if strings.Contains(body["error"], "detalle interno") {
		t.Error("el error interno se filtró al cliente")
	}
}
