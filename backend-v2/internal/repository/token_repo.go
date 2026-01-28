package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/waillet-app/backend-v2/internal/models"
)

type TokenRepository interface {
	GetAll(ctx context.Context, limit int) ([]models.Token, error)
	GetBySymbol(ctx context.Context, symbol string) (*models.Token, error)
	GetByCMCID(ctx context.Context, cmcID int) (*models.Token, error)
	GetTokensForNetwork(ctx context.Context, networkSlug string) ([]models.TokenWithNetworkSlug, error)
	GetTokenWithAddresses(ctx context.Context, symbol string) (*models.TokenWithAddresses, error)
	GetTokenPrice(ctx context.Context, symbol string) (float64, error)
	GetTokenPrices(ctx context.Context, symbols []string) (map[string]float64, error)
	UpsertToken(ctx context.Context, token *models.Token) error
	UpsertTokenAddress(ctx context.Context, addr *models.TokenAddress) error
	BulkUpsertTokens(ctx context.Context, tokens []models.Token) error
}

type tokenRepository struct {
	db *sqlx.DB
}

func NewTokenRepository(db *sqlx.DB) TokenRepository {
	return &tokenRepository{db: db}
}

func (r *tokenRepository) GetAll(ctx context.Context, limit int) ([]models.Token, error) {
	var tokens []models.Token
	query := `SELECT id, cmc_id, symbol, name, slug, cmc_rank, price_usd, market_cap_usd,
		volume_24h_usd, percent_change_24h, percent_change_7d, circulating_supply,
		total_supply, logo_url, is_active, last_price_update, created_at, updated_at
		FROM tokens WHERE is_active = TRUE ORDER BY cmc_rank ASC LIMIT ?`

	err := r.db.SelectContext(ctx, &tokens, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get tokens: %w", err)
	}
	return tokens, nil
}

func (r *tokenRepository) GetBySymbol(ctx context.Context, symbol string) (*models.Token, error) {
	var token models.Token
	query := `SELECT id, cmc_id, symbol, name, slug, cmc_rank, price_usd, market_cap_usd,
		volume_24h_usd, percent_change_24h, percent_change_7d, circulating_supply,
		total_supply, logo_url, is_active, last_price_update, created_at, updated_at
		FROM tokens WHERE UPPER(symbol) = UPPER(?) AND is_active = TRUE`

	err := r.db.GetContext(ctx, &token, query, symbol)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get token: %w", err)
	}
	return &token, nil
}

func (r *tokenRepository) GetByCMCID(ctx context.Context, cmcID int) (*models.Token, error) {
	var token models.Token
	query := `SELECT id, cmc_id, symbol, name, slug, cmc_rank, price_usd, market_cap_usd,
		volume_24h_usd, percent_change_24h, percent_change_7d, circulating_supply,
		total_supply, logo_url, is_active, last_price_update, created_at, updated_at
		FROM tokens WHERE cmc_id = ?`

	err := r.db.GetContext(ctx, &token, query, cmcID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get token by cmc_id: %w", err)
	}
	return &token, nil
}

func (r *tokenRepository) GetTokensForNetwork(ctx context.Context, networkSlug string) ([]models.TokenWithNetworkSlug, error) {
	var tokens []models.TokenWithNetworkSlug
	query := `SELECT t.id, t.cmc_id, t.symbol, t.name, t.slug, t.cmc_rank, t.price_usd,
		t.market_cap_usd, t.volume_24h_usd, t.percent_change_24h, t.percent_change_7d,
		t.circulating_supply, t.total_supply, t.logo_url, t.is_active, t.last_price_update,
		t.created_at, t.updated_at,
		n.slug as network_slug, ta.contract_address, ta.decimals, ta.is_native
		FROM tokens t
		JOIN token_addresses ta ON t.id = ta.token_id
		JOIN networks n ON ta.network_id = n.id
		WHERE n.slug = ? AND t.is_active = TRUE
		ORDER BY t.cmc_rank ASC`

	err := r.db.SelectContext(ctx, &tokens, query, networkSlug)
	if err != nil {
		return nil, fmt.Errorf("failed to get tokens for network: %w", err)
	}
	return tokens, nil
}

func (r *tokenRepository) GetTokenWithAddresses(ctx context.Context, symbol string) (*models.TokenWithAddresses, error) {
	// First get the token
	token, err := r.GetBySymbol(ctx, symbol)
	if err != nil {
		return nil, err
	}
	if token == nil {
		return nil, nil
	}

	// Then get all addresses for this token
	query := `SELECT n.slug as network_slug, ta.contract_address, ta.decimals, ta.is_native
		FROM token_addresses ta
		JOIN networks n ON ta.network_id = n.id
		WHERE ta.token_id = ?`

	type addressRow struct {
		NetworkSlug     string `db:"network_slug"`
		ContractAddress string `db:"contract_address"`
		Decimals        int    `db:"decimals"`
		IsNative        bool   `db:"is_native"`
	}
	var addresses []addressRow
	err = r.db.SelectContext(ctx, &addresses, query, token.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get token addresses: %w", err)
	}

	result := &models.TokenWithAddresses{
		Token:     token.ToResponse(),
		Addresses: make(map[string]models.TokenAddressDTO),
	}

	for _, addr := range addresses {
		result.Addresses[addr.NetworkSlug] = models.TokenAddressDTO{
			ContractAddress: addr.ContractAddress,
			Decimals:        addr.Decimals,
			IsNative:        addr.IsNative,
		}
	}

	return result, nil
}

func (r *tokenRepository) GetTokenPrice(ctx context.Context, symbol string) (float64, error) {
	var price sql.NullFloat64
	query := `SELECT price_usd FROM tokens WHERE UPPER(symbol) = UPPER(?) AND is_active = TRUE`

	err := r.db.GetContext(ctx, &price, query, symbol)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, nil
		}
		return 0, fmt.Errorf("failed to get token price: %w", err)
	}
	if !price.Valid {
		return 0, nil
	}
	return price.Float64, nil
}

func (r *tokenRepository) GetTokenPrices(ctx context.Context, symbols []string) (map[string]float64, error) {
	if len(symbols) == 0 {
		return make(map[string]float64), nil
	}

	// Build placeholders for IN clause
	placeholders := make([]string, len(symbols))
	args := make([]interface{}, len(symbols))
	for i, s := range symbols {
		placeholders[i] = "?"
		args[i] = strings.ToUpper(s)
	}

	query := fmt.Sprintf(`SELECT symbol, price_usd FROM tokens WHERE UPPER(symbol) IN (%s) AND is_active = TRUE`,
		strings.Join(placeholders, ","))

	type priceRow struct {
		Symbol   string          `db:"symbol"`
		PriceUSD sql.NullFloat64 `db:"price_usd"`
	}
	var rows []priceRow
	err := r.db.SelectContext(ctx, &rows, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get token prices: %w", err)
	}

	prices := make(map[string]float64)
	for _, row := range rows {
		if row.PriceUSD.Valid {
			prices[row.Symbol] = row.PriceUSD.Float64
		}
	}
	return prices, nil
}

func (r *tokenRepository) UpsertToken(ctx context.Context, token *models.Token) error {
	query := `INSERT INTO tokens (cmc_id, symbol, name, slug, cmc_rank, price_usd, market_cap_usd,
		volume_24h_usd, percent_change_24h, percent_change_7d, circulating_supply,
		total_supply, logo_url, last_price_update)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
		ON DUPLICATE KEY UPDATE
			symbol = VALUES(symbol),
			name = VALUES(name),
			cmc_rank = VALUES(cmc_rank),
			price_usd = VALUES(price_usd),
			market_cap_usd = VALUES(market_cap_usd),
			volume_24h_usd = VALUES(volume_24h_usd),
			percent_change_24h = VALUES(percent_change_24h),
			percent_change_7d = VALUES(percent_change_7d),
			circulating_supply = VALUES(circulating_supply),
			total_supply = VALUES(total_supply),
			logo_url = VALUES(logo_url),
			last_price_update = NOW()`

	_, err := r.db.ExecContext(ctx, query,
		token.CMCID,
		token.Symbol,
		token.Name,
		token.Slug,
		token.CMCRank,
		token.PriceUSD,
		token.MarketCapUSD,
		token.Volume24hUSD,
		token.PercentChange24h,
		token.PercentChange7d,
		token.CirculatingSupply,
		token.TotalSupply,
		token.LogoURL,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert token: %w", err)
	}
	return nil
}

func (r *tokenRepository) UpsertTokenAddress(ctx context.Context, addr *models.TokenAddress) error {
	query := `INSERT INTO token_addresses (token_id, network_id, contract_address, decimals, is_native, is_verified)
		VALUES (?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			contract_address = VALUES(contract_address),
			decimals = VALUES(decimals),
			is_native = VALUES(is_native),
			is_verified = VALUES(is_verified)`

	_, err := r.db.ExecContext(ctx, query,
		addr.TokenID,
		addr.NetworkID,
		addr.ContractAddress,
		addr.Decimals,
		addr.IsNative,
		addr.IsVerified,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert token address: %w", err)
	}
	return nil
}

func (r *tokenRepository) BulkUpsertTokens(ctx context.Context, tokens []models.Token) error {
	if len(tokens) == 0 {
		return nil
	}

	// Use a transaction for bulk insert
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `INSERT INTO tokens (cmc_id, symbol, name, slug, cmc_rank, price_usd, market_cap_usd,
		volume_24h_usd, percent_change_24h, percent_change_7d, circulating_supply,
		total_supply, logo_url, last_price_update)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
		ON DUPLICATE KEY UPDATE
			symbol = VALUES(symbol),
			name = VALUES(name),
			cmc_rank = VALUES(cmc_rank),
			price_usd = VALUES(price_usd),
			market_cap_usd = VALUES(market_cap_usd),
			volume_24h_usd = VALUES(volume_24h_usd),
			percent_change_24h = VALUES(percent_change_24h),
			percent_change_7d = VALUES(percent_change_7d),
			circulating_supply = VALUES(circulating_supply),
			total_supply = VALUES(total_supply),
			logo_url = VALUES(logo_url),
			last_price_update = NOW()`

	stmt, err := tx.PrepareContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, token := range tokens {
		_, err := stmt.ExecContext(ctx,
			token.CMCID,
			token.Symbol,
			token.Name,
			token.Slug,
			token.CMCRank,
			token.PriceUSD,
			token.MarketCapUSD,
			token.Volume24hUSD,
			token.PercentChange24h,
			token.PercentChange7d,
			token.CirculatingSupply,
			token.TotalSupply,
			token.LogoURL,
		)
		if err != nil {
			return fmt.Errorf("failed to insert token %s: %w", token.Symbol, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
