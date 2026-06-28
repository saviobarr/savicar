package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"golang.org/x/crypto/bcrypt"
	"savicar-api/internal/domain/user"
)

type SQLServerUserRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerUserRepository(db *sql.DB) *SQLServerUserRepository {
	return &SQLServerUserRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.user"),
	}
}

func (r *SQLServerUserRepository) FindAll(ctx context.Context) ([]user.User, error) {
	query := "SELECT ID_USER, ID_TENANT, NAME, USER_NAME, PROFILE FROM USERS ORDER BY NAME"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []user.User
	for rows.Next() {
		var u user.User
		if err := rows.Scan(&u.IDUser, &u.IDTenant, &u.Name, &u.UserName, &u.Profile); err != nil {
			return nil, err
		}
		result = append(result, u)
	}
	return result, rows.Err()
}

func (r *SQLServerUserRepository) FindByID(ctx context.Context, id int) (*user.User, error) {
	query := "SELECT ID_USER, ID_TENANT, NAME, USER_NAME, PROFILE FROM USERS WHERE ID_USER = ?"
	var u user.User
	err := r.db.QueryRowContext(ctx, query, id).Scan(&u.IDUser, &u.IDTenant, &u.Name, &u.UserName, &u.Profile)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	return &u, nil
}

func (r *SQLServerUserRepository) Create(ctx context.Context, u *user.User) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	query := "INSERT INTO USERS (ID_TENANT, NAME, USER_NAME, PASSWORD, PROFILE) VALUES (?, ?, ?, ?, ?)"
	result, err := r.db.ExecContext(ctx, query, u.IDTenant, u.Name, u.UserName, string(hash), u.Profile)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	u.IDUser = int(id)
	u.Password = ""
	return nil
}

func (r *SQLServerUserRepository) Update(ctx context.Context, u *user.User) error {
	var err error
	if u.Password != "" {
		hash, herr := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if herr != nil {
			return herr
		}
		query := "UPDATE USERS SET ID_TENANT = ?, NAME = ?, USER_NAME = ?, PASSWORD = ?, PROFILE = ? WHERE ID_USER = ?"
		_, err = r.db.ExecContext(ctx, query, u.IDTenant, u.Name, u.UserName, string(hash), u.Profile, u.IDUser)
	} else {
		query := "UPDATE USERS SET ID_TENANT = ?, NAME = ?, USER_NAME = ?, PROFILE = ? WHERE ID_USER = ?"
		_, err = r.db.ExecContext(ctx, query, u.IDTenant, u.Name, u.UserName, u.Profile, u.IDUser)
	}
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", u.IDUser), slog.Any("error", err))
	}
	u.Password = ""
	return err
}

func (r *SQLServerUserRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM USERS WHERE ID_USER = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}
