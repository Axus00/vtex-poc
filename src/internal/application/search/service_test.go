package search_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"vtex-poc/src/internal/application/search"
	"vtex-poc/src/internal/vtex"
)

// fakeVTEXClient registra los argumentos recibidos y devuelve una respuesta fija
type fakeVTEXClient struct {
	resp *vtex.SearchResponse
	err  error

	calls     int
	lastQuery string
	lastCount int
}

func (f *fakeVTEXClient) Search(_ context.Context, query string, count int) (*vtex.SearchResponse, error) {
	f.calls++
	f.lastQuery = query
	f.lastCount = count
	if f.err != nil {
		return nil, f.err
	}
	if f.resp == nil {
		return &vtex.SearchResponse{}, nil
	}
	return f.resp, nil
}

// fixture con la forma real del JSON de Intelligent Search (campos relevantes)
const vtexFixture = `{
  "recordsFiltered": 42,
  "products": [
    {
      "productId": "1",
      "productName": "Work Shirt",
      "description": "Wanna look awesome at your work place?",
      "brand": "New Offers!!",
      "link": "/working-shirt/p",
      "linkText": "working-shirt",
      "priceRange": {
        "sellingPrice": {"highPrice": 2600, "lowPrice": 45},
        "listPrice": {"highPrice": 2600, "lowPrice": 60.5}
      },
      "items": [
        {"images": [
          {"imageId": "155580", "imageLabel": "", "imageUrl": "https://example.com/work-shirt.jpg"},
          {"imageId": "155581", "imageLabel": "", "imageUrl": "https://example.com/work-shirt-2.jpg"}
        ]},
        {"images": [
          {"imageId": "155590", "imageLabel": "", "imageUrl": "https://example.com/other-sku.jpg"}
        ]}
      ]
    },
    {
      "productId": "2",
      "productName": "Sin Imagen",
      "description": "",
      "brand": "",
      "link": "/sin-imagen/p",
      "items": []
    }
  ]
}`

func decodeFixture(t *testing.T) *vtex.SearchResponse {
	t.Helper()
	var resp vtex.SearchResponse
	if err := json.Unmarshal([]byte(vtexFixture), &resp); err != nil {
		t.Fatalf("decodificando fixture: %v", err)
	}
	return &resp
}

func TestServiceSearch_MapsProducts(t *testing.T) {
	client := &fakeVTEXClient{resp: decodeFixture(t)}
	svc := search.NewService(client)

	got, err := svc.Search(context.Background(), search.Request{Query: "shirt", Count: 5})
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}

	if client.lastQuery != "shirt" {
		t.Errorf("query enviada = %q, want %q", client.lastQuery, "shirt")
	}
	if got.Total != 42 {
		t.Errorf("Total = %d, want 42", got.Total)
	}
	if len(got.Products) != 2 {
		t.Fatalf("len(Products) = %d, want 2", len(got.Products))
	}

	want := search.Product{
		ID:          "1",
		Name:        "Work Shirt",
		Link:        "/working-shirt/p",
		Image:       "https://example.com/work-shirt.jpg", // primera imagen del primer SKU
		Description: "Wanna look awesome at your work place?",
		Brand:       "New Offers!!",
		Price:       45,
		ListPrice:   60.5,
	}
	if got.Products[0] != want {
		t.Errorf("Products[0] = %+v, want %+v", got.Products[0], want)
	}

	// sin SKUs/imágenes: Image vacía y precios en cero, sin panics
	second := got.Products[1]
	if second.ID != "2" || second.Image != "" || second.Price != 0 || second.ListPrice != 0 {
		t.Errorf("Products[1] = %+v, want ID=2 sin imagen ni precios", second)
	}
}

func TestServiceSearch_EmptyProductsIsNotNil(t *testing.T) {
	svc := search.NewService(&fakeVTEXClient{resp: &vtex.SearchResponse{}})

	got, err := svc.Search(context.Background(), search.Request{Query: "nada"})
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	// el front espera "products": [] y no null
	if got.Products == nil {
		t.Error("Products es nil, se esperaba slice vacío")
	}
}

func TestServiceSearch_EmptyQuery(t *testing.T) {
	client := &fakeVTEXClient{}
	svc := search.NewService(client)

	_, err := svc.Search(context.Background(), search.Request{Query: ""})
	if !errors.Is(err, search.ErrEmptyQuery) {
		t.Fatalf("err = %v, want ErrEmptyQuery", err)
	}
	if client.calls != 0 {
		t.Errorf("el cliente VTEX se llamó %d veces con query vacía", client.calls)
	}
}

func TestServiceSearch_CountDefaults(t *testing.T) {
	tests := []struct {
		name  string
		count int
		want  int
	}{
		{"cero usa default", 0, 10},
		{"negativo usa default", -3, 10},
		{"mayor a 50 usa default", 51, 10},
		{"límite superior se respeta", 50, 50},
		{"valor válido se respeta", 5, 5},
		{"mínimo válido se respeta", 1, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeVTEXClient{}
			svc := search.NewService(client)

			if _, err := svc.Search(context.Background(), search.Request{Query: "shirt", Count: tt.count}); err != nil {
				t.Fatalf("error inesperado: %v", err)
			}
			if client.lastCount != tt.want {
				t.Errorf("count enviado = %d, want %d", client.lastCount, tt.want)
			}
		})
	}
}

func TestServiceSearch_ClientError(t *testing.T) {
	vtexErr := errors.New("vtex: status 503")
	svc := search.NewService(&fakeVTEXClient{err: vtexErr})

	got, err := svc.Search(context.Background(), search.Request{Query: "shirt"})
	if !errors.Is(err, vtexErr) {
		t.Fatalf("err = %v, want %v", err, vtexErr)
	}
	if got.Total != 0 || got.Products != nil {
		t.Errorf("resultado = %+v, want vacío en error", got)
	}
}
