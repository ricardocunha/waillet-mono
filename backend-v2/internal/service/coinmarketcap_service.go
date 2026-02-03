package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/config"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
)

const (
	cmcBaseURL  = "https://pro-api.coinmarketcap.com/v1"
	cacheExpiry = 5 * time.Minute
)

// CMC API Response structures
type CMCListingsResponse struct {
	Status CMCStatus      `json:"status"`
	Data   []CMCTokenData `json:"data"`
}

type CMCStatus struct {
	Timestamp    string `json:"timestamp"`
	ErrorCode    int    `json:"error_code"`
	ErrorMessage string `json:"error_message"`
	CreditCount  int    `json:"credit_count"`
}

type CMCTokenData struct {
	ID                int      `json:"id"`
	Name              string   `json:"name"`
	Symbol            string   `json:"symbol"`
	Slug              string   `json:"slug"`
	CMCRank           int      `json:"cmc_rank"`
	CirculatingSupply float64  `json:"circulating_supply"`
	TotalSupply       float64  `json:"total_supply"`
	Quote             CMCQuote `json:"quote"`
}

type CMCQuote struct {
	USD CMCPriceData `json:"USD"`
}

type CMCPriceData struct {
	Price            float64 `json:"price"`
	Volume24h        float64 `json:"volume_24h"`
	MarketCap        float64 `json:"market_cap"`
	PercentChange24h float64 `json:"percent_change_24h"`
	PercentChange7d  float64 `json:"percent_change_7d"`
}

// Cached price data
type priceCache struct {
	prices    map[string]float64 // symbol -> price
	timestamp time.Time
	mu        sync.RWMutex
}

type CoinMarketCapService struct {
	apiKey       string
	syncInterval time.Duration
	httpClient   *http.Client
	tokenRepo    repository.TokenRepository
	cache        *priceCache
}

func NewCoinMarketCapService(cfg *config.CoinMarketCapConfig, tokenRepo repository.TokenRepository) *CoinMarketCapService {
	return &CoinMarketCapService{
		apiKey:       cfg.APIKey,
		syncInterval: cfg.SyncInterval,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		tokenRepo:    tokenRepo,
		cache: &priceCache{
			prices: make(map[string]float64),
		},
	}
}

// FetchTop100Tokens fetches the top 100 cryptocurrencies by market cap
func (s *CoinMarketCapService) FetchTop100Tokens(ctx context.Context) ([]models.Token, error) {
	if s.apiKey == "" {
		log.Warn().Msg("CoinMarketCap API key not configured, skipping fetch")
		return nil, fmt.Errorf("CMC API key not configured")
	}

	url := fmt.Sprintf("%s/cryptocurrency/listings/latest?start=1&limit=100&convert=USD", cmcBaseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("X-CMC_PRO_API_KEY", s.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from CMC: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CMC API error: HTTP %d", resp.StatusCode)
	}

	var cmcResp CMCListingsResponse
	if err := json.NewDecoder(resp.Body).Decode(&cmcResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if cmcResp.Status.ErrorCode != 0 {
		return nil, fmt.Errorf("CMC API error: %s", cmcResp.Status.ErrorMessage)
	}

	// Convert to models
	tokens := make([]models.Token, len(cmcResp.Data))
	for i, data := range cmcResp.Data {
		tokens[i] = s.cmcDataToToken(data)
	}

	log.Info().Int("count", len(tokens)).Int("credits", cmcResp.Status.CreditCount).Msg("Fetched tokens from CoinMarketCap")

	return tokens, nil
}

// GetPrice returns cached price or fetches from DB
func (s *CoinMarketCapService) GetPrice(ctx context.Context, symbol string) (float64, error) {
	// Check cache first
	s.cache.mu.RLock()
	if time.Since(s.cache.timestamp) < cacheExpiry {
		if price, ok := s.cache.prices[symbol]; ok {
			s.cache.mu.RUnlock()
			return price, nil
		}
	}
	s.cache.mu.RUnlock()

	// Get from database
	return s.tokenRepo.GetTokenPrice(ctx, symbol)
}

// GetPrices returns prices for multiple tokens (from cache or DB)
func (s *CoinMarketCapService) GetPrices(ctx context.Context, symbols []string) (map[string]float64, error) {
	// Check if cache is fresh
	s.cache.mu.RLock()
	cacheFresh := time.Since(s.cache.timestamp) < cacheExpiry
	s.cache.mu.RUnlock()

	if cacheFresh {
		prices := make(map[string]float64)
		s.cache.mu.RLock()
		for _, symbol := range symbols {
			if price, ok := s.cache.prices[symbol]; ok {
				prices[symbol] = price
			}
		}
		s.cache.mu.RUnlock()

		// If we found all prices in cache, return them
		if len(prices) == len(symbols) {
			return prices, nil
		}
	}

	// Fetch from database
	return s.tokenRepo.GetTokenPrices(ctx, symbols)
}

// SyncTokens fetches and stores tokens from CoinMarketCap
func (s *CoinMarketCapService) SyncTokens(ctx context.Context) error {
	tokens, err := s.FetchTop100Tokens(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch tokens: %w", err)
	}

	// Bulk upsert to database
	if err := s.tokenRepo.BulkUpsertTokens(ctx, tokens); err != nil {
		return fmt.Errorf("failed to store tokens: %w", err)
	}

	// Update cache
	s.cache.mu.Lock()
	s.cache.timestamp = time.Now()
	for _, t := range tokens {
		if t.PriceUSD.Valid {
			s.cache.prices[t.Symbol] = t.PriceUSD.Float64
		}
	}
	s.cache.mu.Unlock()

	log.Info().Int("count", len(tokens)).Msg("Synced tokens to database")
	return nil
}

// StartPeriodicSync starts a background goroutine to sync tokens periodically
func (s *CoinMarketCapService) StartPeriodicSync(ctx context.Context) {
	if s.apiKey == "" {
		log.Warn().Msg("CoinMarketCap API key not configured, periodic sync disabled")
		return
	}

	go func() {
		// Initial sync
		if err := s.SyncTokens(ctx); err != nil {
			log.Error().Err(err).Msg("Initial token sync failed")
		}

		ticker := time.NewTicker(s.syncInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Info().Msg("Stopping CoinMarketCap periodic sync")
				return
			case <-ticker.C:
				if err := s.SyncTokens(ctx); err != nil {
					log.Error().Err(err).Msg("Periodic token sync failed")
				}
			}
		}
	}()

	log.Info().Dur("interval", s.syncInterval).Msg("Started CoinMarketCap periodic sync")
}

func (s *CoinMarketCapService) cmcDataToToken(data CMCTokenData) models.Token {
	// Generate logo URL from CoinMarketCap CDN using the CMC ID
	// Format: https://s2.coinmarketcap.com/static/img/coins/64x64/{cmc_id}.png
	logoURL := fmt.Sprintf("https://s2.coinmarketcap.com/static/img/coins/64x64/%d.png", data.ID)

	return models.Token{
		CMCID:             data.ID,
		Symbol:            data.Symbol,
		Name:              data.Name,
		Slug:              data.Slug,
		CMCRank:           sql.NullInt64{Int64: int64(data.CMCRank), Valid: true},
		PriceUSD:          sql.NullFloat64{Float64: data.Quote.USD.Price, Valid: true},
		MarketCapUSD:      sql.NullFloat64{Float64: data.Quote.USD.MarketCap, Valid: true},
		Volume24hUSD:      sql.NullFloat64{Float64: data.Quote.USD.Volume24h, Valid: true},
		PercentChange24h:  sql.NullFloat64{Float64: data.Quote.USD.PercentChange24h, Valid: true},
		PercentChange7d:   sql.NullFloat64{Float64: data.Quote.USD.PercentChange7d, Valid: true},
		CirculatingSupply: sql.NullFloat64{Float64: data.CirculatingSupply, Valid: data.CirculatingSupply > 0},
		TotalSupply:       sql.NullFloat64{Float64: data.TotalSupply, Valid: data.TotalSupply > 0},
		LogoURL:           sql.NullString{String: logoURL, Valid: true},
		IsActive:          true,
	}
}

// IsConfigured returns true if the service has an API key configured
func (s *CoinMarketCapService) IsConfigured() bool {
	return s.apiKey != ""
}
