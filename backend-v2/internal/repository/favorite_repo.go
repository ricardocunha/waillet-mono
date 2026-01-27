package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/waillet-app/backend-v2/internal/models"
)

type FavoriteRepository interface {
	GetByWalletAddress(ctx context.Context, walletAddress string) ([]models.Favorite, error)
	GetByID(ctx context.Context, id int64) (*models.Favorite, error)
	GetByAlias(ctx context.Context, walletAddress, alias string) (*models.Favorite, error)
	Create(ctx context.Context, favorite *models.Favorite) error
	Update(ctx context.Context, favorite *models.Favorite) error
	Delete(ctx context.Context, id int64) error
}

type favoriteRepository struct {
	db *sqlx.DB
}

func NewFavoriteRepository(db *sqlx.DB) FavoriteRepository {
	return &favoriteRepository{db: db}
}

func (r *favoriteRepository) GetByWalletAddress(ctx context.Context, walletAddress string) ([]models.Favorite, error) {
	var favorites []models.Favorite
	query := `SELECT id, wallet_address, alias, address, asset, type, value, created_at, updated_at
		FROM favorites WHERE LOWER(wallet_address) = LOWER(?) ORDER BY created_at DESC`

	err := r.db.SelectContext(ctx, &favorites, query, walletAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get favorites: %w", err)
	}

	return favorites, nil
}

func (r *favoriteRepository) GetByID(ctx context.Context, id int64) (*models.Favorite, error) {
	var favorite models.Favorite
	query := `SELECT id, wallet_address, alias, address, asset, type, value, created_at, updated_at
		FROM favorites WHERE id = ?`

	err := r.db.GetContext(ctx, &favorite, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get favorite: %w", err)
	}

	return &favorite, nil
}

func (r *favoriteRepository) GetByAlias(ctx context.Context, walletAddress, alias string) (*models.Favorite, error) {
	var favorite models.Favorite
	query := `SELECT id, wallet_address, alias, address, asset, type, value, created_at, updated_at
		FROM favorites WHERE LOWER(wallet_address) = LOWER(?) AND LOWER(alias) = LOWER(?)`

	err := r.db.GetContext(ctx, &favorite, query, walletAddress, alias)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get favorite by alias: %w", err)
	}

	return &favorite, nil
}

func (r *favoriteRepository) Create(ctx context.Context, favorite *models.Favorite) error {
	query := `INSERT INTO favorites (wallet_address, alias, address, asset, type, value)
		VALUES (?, ?, ?, ?, ?, ?)`

	result, err := r.db.ExecContext(ctx, query,
		favorite.WalletAddress,
		favorite.Alias,
		favorite.Address,
		favorite.Asset,
		favorite.Type,
		favorite.Value,
	)
	if err != nil {
		return fmt.Errorf("failed to create favorite: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	favorite.ID = id

	return nil
}

func (r *favoriteRepository) Update(ctx context.Context, favorite *models.Favorite) error {
	query := `UPDATE favorites SET alias = ?, address = ?, asset = ?, type = ?, value = ?
		WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query,
		favorite.Alias,
		favorite.Address,
		favorite.Asset,
		favorite.Type,
		favorite.Value,
		favorite.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update favorite: %w", err)
	}

	return nil
}

func (r *favoriteRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM favorites WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete favorite: %w", err)
	}

	return nil
}
