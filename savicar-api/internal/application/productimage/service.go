package productimage

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/productimage"
)

type Service struct {
	repo productimage.Repository
}

func NewService(repo productimage.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetByProductID(ctx context.Context, productID int) ([]productimage.ProductImage, error) {
	return s.repo.FindByProductID(ctx, productID)
}

func (s *Service) GetByID(ctx context.Context, id int) (*productimage.ProductImage, error) {
	img, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if img == nil {
		return nil, fmt.Errorf("image %d not found", id)
	}
	return img, nil
}

func (s *Service) Create(ctx context.Context, img *productimage.ProductImage) error {
	return s.repo.Create(ctx, img)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

