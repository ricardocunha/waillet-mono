package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/waillet-app/backend-v2/internal/models"
)

type NetworkRepository interface {
	GetAll(ctx context.Context) ([]models.Network, error)
	GetActive(ctx context.Context) ([]models.Network, error)
	GetBySlug(ctx context.Context, slug string) (*models.Network, error)
	GetByChainID(ctx context.Context, chainID int) (*models.Network, error)
	GetByChainType(ctx context.Context, chainType models.ChainType) ([]models.Network, error)
	GetActiveByChainType(ctx context.Context, chainType models.ChainType) ([]models.Network, error)
	Create(ctx context.Context, network *models.Network) error
	Update(ctx context.Context, network *models.Network) error
}

type networkRepository struct {
	db *sqlx.DB
}

func NewNetworkRepository(db *sqlx.DB) NetworkRepository {
	return &networkRepository{db: db}
}

func (r *networkRepository) GetAll(ctx context.Context) ([]models.Network, error) {
	var networks []models.Network
	query := `SELECT id, slug, chain_type, name, chain_id, rpc_url, rpc_url_fallback, explorer_url,
		native_currency_symbol, native_currency_name, native_currency_decimals,
		is_testnet, is_active, display_color, icon_url, sort_order, created_at, updated_at
		FROM networks ORDER BY sort_order ASC, name ASC`

	err := r.db.SelectContext(ctx, &networks, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get networks: %w", err)
	}
	return networks, nil
}

func (r *networkRepository) GetActive(ctx context.Context) ([]models.Network, error) {
	var networks []models.Network
	query := `SELECT id, slug, chain_type, name, chain_id, rpc_url, rpc_url_fallback, explorer_url,
		native_currency_symbol, native_currency_name, native_currency_decimals,
		is_testnet, is_active, display_color, icon_url, sort_order, created_at, updated_at
		FROM networks WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`

	err := r.db.SelectContext(ctx, &networks, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get active networks: %w", err)
	}
	return networks, nil
}

func (r *networkRepository) GetBySlug(ctx context.Context, slug string) (*models.Network, error) {
	var network models.Network
	query := `SELECT id, slug, chain_type, name, chain_id, rpc_url, rpc_url_fallback, explorer_url,
		native_currency_symbol, native_currency_name, native_currency_decimals,
		is_testnet, is_active, display_color, icon_url, sort_order, created_at, updated_at
		FROM networks WHERE slug = ?`

	err := r.db.GetContext(ctx, &network, query, slug)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get network: %w", err)
	}
	return &network, nil
}

func (r *networkRepository) GetByChainID(ctx context.Context, chainID int) (*models.Network, error) {
	var network models.Network
	query := `SELECT id, slug, chain_type, name, chain_id, rpc_url, rpc_url_fallback, explorer_url,
		native_currency_symbol, native_currency_name, native_currency_decimals,
		is_testnet, is_active, display_color, icon_url, sort_order, created_at, updated_at
		FROM networks WHERE chain_id = ?`

	err := r.db.GetContext(ctx, &network, query, chainID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get network by chain_id: %w", err)
	}
	return &network, nil
}

func (r *networkRepository) GetByChainType(ctx context.Context, chainType models.ChainType) ([]models.Network, error) {
	var networks []models.Network
	query := `SELECT id, slug, chain_type, name, chain_id, rpc_url, rpc_url_fallback, explorer_url,
		native_currency_symbol, native_currency_name, native_currency_decimals,
		is_testnet, is_active, display_color, icon_url, sort_order, created_at, updated_at
		FROM networks WHERE chain_type = ? ORDER BY sort_order ASC, name ASC`

	err := r.db.SelectContext(ctx, &networks, query, chainType)
	if err != nil {
		return nil, fmt.Errorf("failed to get networks by chain_type: %w", err)
	}
	return networks, nil
}

func (r *networkRepository) GetActiveByChainType(ctx context.Context, chainType models.ChainType) ([]models.Network, error) {
	var networks []models.Network
	query := `SELECT id, slug, chain_type, name, chain_id, rpc_url, rpc_url_fallback, explorer_url,
		native_currency_symbol, native_currency_name, native_currency_decimals,
		is_testnet, is_active, display_color, icon_url, sort_order, created_at, updated_at
		FROM networks WHERE chain_type = ? AND is_active = TRUE ORDER BY sort_order ASC, name ASC`

	err := r.db.SelectContext(ctx, &networks, query, chainType)
	if err != nil {
		return nil, fmt.Errorf("failed to get active networks by chain_type: %w", err)
	}
	return networks, nil
}

func (r *networkRepository) Create(ctx context.Context, network *models.Network) error {
	query := `INSERT INTO networks (slug, chain_type, name, chain_id, rpc_url, rpc_url_fallback, explorer_url,
		native_currency_symbol, native_currency_name, native_currency_decimals,
		is_testnet, is_active, display_color, icon_url, sort_order)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := r.db.ExecContext(ctx, query,
		network.Slug,
		network.ChainType,
		network.Name,
		network.ChainID,
		network.RPCURL,
		network.RPCURLFallback,
		network.ExplorerURL,
		network.NativeCurrencySymbol,
		network.NativeCurrencyName,
		network.NativeCurrencyDecimals,
		network.IsTestnet,
		network.IsActive,
		network.DisplayColor,
		network.IconURL,
		network.SortOrder,
	)
	if err != nil {
		return fmt.Errorf("failed to create network: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	network.ID = id

	return nil
}

func (r *networkRepository) Update(ctx context.Context, network *models.Network) error {
	query := `UPDATE networks SET name = ?, rpc_url = ?, rpc_url_fallback = ?, explorer_url = ?,
		native_currency_symbol = ?, native_currency_name = ?, native_currency_decimals = ?,
		is_testnet = ?, is_active = ?, display_color = ?, icon_url = ?, sort_order = ?
		WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query,
		network.Name,
		network.RPCURL,
		network.RPCURLFallback,
		network.ExplorerURL,
		network.NativeCurrencySymbol,
		network.NativeCurrencyName,
		network.NativeCurrencyDecimals,
		network.IsTestnet,
		network.IsActive,
		network.DisplayColor,
		network.IconURL,
		network.SortOrder,
		network.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update network: %w", err)
	}

	return nil
}
