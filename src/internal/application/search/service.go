package search

import (
	"context"
	"errors"

	"vtex-poc/src/internal/vtex"
)

type Request struct {
	Query string
	Count int
}

type Product struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Link        string  `json:"link"`
	Image       string  `json:"image"`
	Description string  `json:"description"`
	Brand       string  `json:"brand"`
	Price       float64 `json:"price"`     // precio de venta más bajo (sellingPrice.lowPrice)
	ListPrice   float64 `json:"listPrice"` // precio de lista más bajo (listPrice.lowPrice)
}

type Result struct {
	Total    int       `json:"total"`
	Products []Product `json:"products"`
}

var ErrEmptyQuery = errors.New("query vacía")

type VTEXClient interface {
	Search(ctx context.Context, query string, count int) (*vtex.SearchResponse, error)
}

type Service struct {
	client VTEXClient
}

func NewService(client VTEXClient) *Service {
	return &Service{client: client}
}

func (s *Service) Search(ctx context.Context, req Request) (Result, error) {
	if req.Query == "" {
		return Result{}, ErrEmptyQuery
	}
	if req.Count <= 0 || req.Count > 50 {
		req.Count = 10
	}

	resp, err := s.client.Search(ctx, req.Query, req.Count)
	if err != nil {
		return Result{}, err
	}

	products := make([]Product, 0, len(resp.Products))
	for _, p := range resp.Products {
		products = append(products, Product{
			ID:          p.ProductID,
			Name:        p.ProductName,
			Link:        p.Link,
			Image:       p.MainImage(),
			Description: p.Description,
			Brand:       p.Brand,
			Price:       p.PriceRange.SellingPrice.LowPrice,
			ListPrice:   p.PriceRange.ListPrice.LowPrice,
		})
	}
	return Result{Total: resp.RecordsFiltered, Products: products}, nil
}
