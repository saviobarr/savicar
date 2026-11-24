package notification

import (
	"context"

	"savicar-api/internal/domain/notification"
	"savicar-api/internal/domain/user"
)

type Service struct {
	repo     notification.Repository
	userRepo user.Repository
}

func NewService(repo notification.Repository, userRepo user.Repository) *Service {
	return &Service{repo: repo, userRepo: userRepo}
}

// NotifyAdmins creates one notification per admin user of the given tenant.
func (s *Service) NotifyAdmins(ctx context.Context, idTenant, idOrder int, message string) error {
	users, err := s.userRepo.FindAll(ctx)
	if err != nil {
		return err
	}
	order := idOrder
	for _, u := range users {
		if u.Profile != user.ProfileAdmin || u.IDTenant != idTenant {
			continue
		}
		n := &notification.Notification{
			IDTenant: idTenant,
			IDUser:   u.IDUser,
			IDOrder:  &order,
			Message:  message,
		}
		if err := s.repo.Create(ctx, n); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) ListByUser(ctx context.Context, idUser int) ([]notification.Notification, error) {
	return s.repo.FindByUser(ctx, idUser, 50)
}

func (s *Service) CountUnread(ctx context.Context, idUser int) (int, error) {
	return s.repo.CountUnread(ctx, idUser)
}

func (s *Service) MarkRead(ctx context.Context, id int, idUser int) error {
	return s.repo.MarkRead(ctx, id, idUser)
}

func (s *Service) MarkAllRead(ctx context.Context, idUser int) error {
	return s.repo.MarkAllRead(ctx, idUser)
}
