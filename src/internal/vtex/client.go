package vtex

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type SearchResponse struct {
	Products        []Product `json:"products"`
	RecordsFiltered int       `json:"recordsFiltered"` // total de resultados
}

type Product struct {
	ProductID   string     `json:"productId"`
	ProductName string     `json:"productName"`
	Description string     `json:"description"`
	Brand       string     `json:"brand"`
	Link        string     `json:"link"`
	PriceRange  PriceRange `json:"priceRange"`

	Items []struct {
		Images []Image `json:"images"`
	} `json:"items"`
}

// PriceRange agrupa el rango de precios de venta y de lista entre todos los SKUs
type PriceRange struct {
	SellingPrice PriceBounds `json:"sellingPrice"`
	ListPrice    PriceBounds `json:"listPrice"`
}

// PriceBounds es el precio más alto y más bajo de un rango
type PriceBounds struct {
	HighPrice float64 `json:"highPrice"`
	LowPrice  float64 `json:"lowPrice"`
}

type Image struct {
	ImageID    string `json:"imageId"`
	ImageLabel string `json:"imageLabel"`
	ImageURL   string `json:"imageUrl"`
}

// MainImage devuelve la primera imagen del primer SKU, o "" si no hay nada
func (p Product) MainImage() string {
	if len(p.Items) > 0 && len(p.Items[0].Images) > 0 {
		return p.Items[0].Images[0].ImageURL
	}
	return ""
}

// Gestionamos la comunicación HTTP  con el servicio Vtex
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient inicializa y retorna una nueva instancia del client Vtex
func NewClient(baseURL string, timeout time.Duration) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *Client) Search(ctx context.Context, query string, count int) (*SearchResponse, error) {
	q := url.Values{}
	q.Set("query", query)
	q.Set("count", strconv.Itoa(count))
	endpoint := c.baseURL + "/api/io/_v/api/intelligent-search/product_search/?" + q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("vtex: creando request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("vtex: llamando a la API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("vtex: status %d: %s", resp.StatusCode, body)
	}

	var out SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("vtex: decodificando JSON: %w", err)
	}
	return &out, nil
}
