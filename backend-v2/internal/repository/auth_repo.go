package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/waillet-app/backend-v2/internal/models"
)

type AuthRepository interface {
	CreateNonce(ctx context.Context, nonce *models.AuthNonce) error
	GetNonceByValue(ctx context.Context, nonce string) (*models.AuthNonce, error)
	GetNonceByWallet(ctx context.Context, walletAddress string) (*models.AuthNonce, error)
	MarkNonceUsed(ctx context.Context, id int64) error
	DeleteExpiredNonces(ctx context.Context) error
}

type authRepository struct {
	db *sqlx.DB
}

func NewAuthRepository(db *sqlx.DB) AuthRepository {
	return &authRepository{db: db}
}

func (r *authRepository) CreateNonce(ctx context.Context, nonce *models.AuthNonce) error {
	query := `INSERT INTO auth_nonces (wallet_address, nonce, expires_at)
		VALUES (?, ?, ?)`

	result, err := r.db.ExecContext(ctx, query,
		nonce.WalletAddress,
		nonce.Nonce,
		nonce.ExpiresAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create nonce: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	nonce.ID = id

	return nil
}

func (r *authRepository) GetNonceByValue(ctx context.Context, nonce string) (*models.AuthNonce, error) {
	var authNonce models.AuthNonce
	query := `SELECT id, wallet_address, nonce, expires_at, used, created_at
		FROM auth_nonces WHERE nonce = ?`

	err := r.db.GetContext(ctx, &authNonce, query, nonce)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get nonce: %w", err)
	}

	return &authNonce, nil
}

func (r *authRepository) GetNonceByWallet(ctx context.Context, walletAddress string) (*models.AuthNonce, error) {
	var authNonce models.AuthNonce
	query := `SELECT id, wallet_address, nonce, expires_at, used, created_at
		FROM auth_nonces WHERE LOWER(wallet_address) = LOWER(?) AND used = FALSE AND expires_at > ?
		ORDER BY created_at DESC LIMIT 1`

	err := r.db.GetContext(ctx, &authNonce, query, walletAddress, time.Now())
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get nonce by wallet: %w", err)
	}

	return &authNonce, nil
}

func (r *authRepository) MarkNonceUsed(ctx context.Context, id int64) error {
	query := `UPDATE auth_nonces SET used = TRUE WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to mark nonce used: %w", err)
	}

	return nil
}

func (r *authRepository) DeleteExpiredNonces(ctx context.Context) error {
	query := `DELETE FROM auth_nonces WHERE expires_at < ? OR used = TRUE`

	_, err := r.db.ExecContext(ctx, query, time.Now().Add(-24*time.Hour))
	if err != nil {
		return fmt.Errorf("failed to delete expired nonces: %w", err)
	}

	return nil
}
