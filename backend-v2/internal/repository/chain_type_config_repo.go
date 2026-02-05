package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/waillet-app/backend-v2/internal/models"
)

type ChainTypeConfigRepository interface {
	GetAll(ctx context.Context) ([]models.ChainTypeConfig, error)
	GetActive(ctx context.Context) ([]models.ChainTypeConfig, error)
	GetByID(ctx context.Context, id string) (*models.ChainTypeConfig, error)
}

type chainTypeConfigRepository struct {
	db *sqlx.DB
}

func NewChainTypeConfigRepository(db *sqlx.DB) ChainTypeConfigRepository {
	return &chainTypeConfigRepository{db: db}
}

func (r *chainTypeConfigRepository) GetAll(ctx context.Context) ([]models.ChainTypeConfig, error) {
	var configs []models.ChainTypeConfig
	query := `SELECT id, name, coin_type, curve, address_format, derivation_template,
		is_active, sort_order, created_at, updated_at
		FROM chain_type_configs ORDER BY sort_order ASC`

	err := r.db.SelectContext(ctx, &configs, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get chain type configs: %w", err)
	}
	return configs, nil
}

func (r *chainTypeConfigRepository) GetActive(ctx context.Context) ([]models.ChainTypeConfig, error) {
	var configs []models.ChainTypeConfig
	query := `SELECT id, name, coin_type, curve, address_format, derivation_template,
		is_active, sort_order, created_at, updated_at
		FROM chain_type_configs WHERE is_active = TRUE ORDER BY sort_order ASC`

	err := r.db.SelectContext(ctx, &configs, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get active chain type configs: %w", err)
	}
	return configs, nil
}

func (r *chainTypeConfigRepository) GetByID(ctx context.Context, id string) (*models.ChainTypeConfig, error) {
	var config models.ChainTypeConfig
	query := `SELECT id, name, coin_type, curve, address_format, derivation_template,
		is_active, sort_order, created_at, updated_at
		FROM chain_type_configs WHERE id = ?`

	err := r.db.GetContext(ctx, &config, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get chain type config: %w", err)
	}
	return &config, nil
}
