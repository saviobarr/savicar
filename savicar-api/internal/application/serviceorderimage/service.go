package serviceorderimage

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/serviceorderimage"
)

type Service struct {
	repo serviceorderimage.Repository
}

func NewService(repo serviceorderimage.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetAll(ctx context.Context) ([]serviceorderimage.ServiceOrderImage, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*serviceorderimage.ServiceOrderImage, error) {
	img, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if img == nil {
		return nil, fmt.Errorf("image %d not found", id)
	}
	return img, nil
}

func (s *Service) GetByOrderID(ctx context.Context, orderID int) ([]serviceorderimage.ServiceOrderImage, error) {
	return s.repo.FindByOrderID(ctx, orderID)
}

func (s *Service) GetImagePathsByOrderID(ctx context.Context, orderID int) ([]string, error) {
	images, err := s.repo.FindByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if len(images) == 0 {
		return nil, fmt.Errorf("no images found for order %d", orderID)
	}

	var paths []string
	for _, img := range images {
		if img.ImagePath != nil && *img.ImagePath != "" {
			paths = append(paths, *img.ImagePath)
		}
	}
	if len(paths) == 0 {
		return nil, fmt.Errorf("order %d has no image files", orderID)
	}
	return paths, nil
}

func (s *Service) Create(ctx context.Context, img *serviceorderimage.ServiceOrderImage) error {
	return s.repo.Create(ctx, img)
}

func (s *Service) Update(ctx context.Context, img *serviceorderimage.ServiceOrderImage) error {
	return s.repo.Update(ctx, img)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

