package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/config"
	"github.com/waillet-app/backend-v2/internal/dto"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
)

type RPCService struct {
	networkRepo   repository.NetworkRepository
	alchemyAPIKey string
	infuraAPIKey  string
	timeout       time.Duration
	httpClient    *http.Client

	// Cache for network URLs
	networkCache     map[string]*models.Network
	networkCacheLock sync.RWMutex
	cacheExpiry      time.Time
	cacheTTL         time.Duration
}

func NewRPCService(cfg *config.RPCConfig, networkRepo repository.NetworkRepository) *RPCService {
	return &RPCService{
		networkRepo:   networkRepo,
		alchemyAPIKey: cfg.AlchemyAPIKey,
		infuraAPIKey:  cfg.InfuraAPIKey,
		timeout:       cfg.Timeout,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
		networkCache: make(map[string]*models.Network),
		cacheTTL:     5 * time.Minute,
	}
}

// Alchemy URL patterns for chains that support Alchemy
var alchemyURLPatterns = map[string]string{
	"ethereum":       "https://eth-mainnet.g.alchemy.com/v2/",
	"sepolia":        "https://eth-sepolia.g.alchemy.com/v2/",
	"base-sepolia":   "https://base-sepolia.g.alchemy.com/v2/",
	"base":           "https://base-mainnet.g.alchemy.com/v2/",
	"polygon":        "https://polygon-mainnet.g.alchemy.com/v2/",
	"arbitrum":       "https://arb-mainnet.g.alchemy.com/v2/",
	"optimism":       "https://opt-mainnet.g.alchemy.com/v2/",
	"linea":          "https://linea-mainnet.g.alchemy.com/v2/",
	"polygon-zkevm":  "https://polygonzkevm-mainnet.g.alchemy.com/v2/",
	"solana-mainnet": "https://solana-mainnet.g.alchemy.com/v2/",
}

// refreshCache refreshes the network cache from the database
func (s *RPCService) refreshCache(ctx context.Context) error {
	s.networkCacheLock.Lock()
	defer s.networkCacheLock.Unlock()

	// Check if cache is still valid
	if time.Now().Before(s.cacheExpiry) && len(s.networkCache) > 0 {
		return nil
	}

	networks, err := s.networkRepo.GetActive(ctx)
	if err != nil {
		return fmt.Errorf("failed to get networks from database: %w", err)
	}

	s.networkCache = make(map[string]*models.Network)
	for i := range networks {
		s.networkCache[networks[i].Slug] = &networks[i]
	}
	s.cacheExpiry = time.Now().Add(s.cacheTTL)

	log.Debug().Int("count", len(networks)).Msg("Refreshed network cache")
	return nil
}

// getNetwork retrieves a network from cache or database
func (s *RPCService) getNetwork(ctx context.Context, slug string) (*models.Network, error) {
	slug = strings.ToLower(slug)

	// Try cache first
	s.networkCacheLock.RLock()
	if network, ok := s.networkCache[slug]; ok && time.Now().Before(s.cacheExpiry) {
		s.networkCacheLock.RUnlock()
		return network, nil
	}
	s.networkCacheLock.RUnlock()

	// Refresh cache
	if err := s.refreshCache(ctx); err != nil {
		log.Warn().Err(err).Msg("Failed to refresh network cache, falling back to direct query")
		// Fall back to direct query
		network, err := s.networkRepo.GetBySlug(ctx, slug)
		if err != nil {
			return nil, err
		}
		return network, nil
	}

	// Try cache again
	s.networkCacheLock.RLock()
	network, ok := s.networkCache[slug]
	s.networkCacheLock.RUnlock()

	if !ok {
		return nil, nil
	}
	return network, nil
}

// GetSupportedChains returns all active network slugs
func (s *RPCService) GetSupportedChains(ctx context.Context) ([]string, error) {
	if err := s.refreshCache(ctx); err != nil {
		return nil, err
	}

	s.networkCacheLock.RLock()
	defer s.networkCacheLock.RUnlock()

	chains := make([]string, 0, len(s.networkCache))
	for slug := range s.networkCache {
		chains = append(chains, slug)
	}
	return chains, nil
}

func (s *RPCService) GetRPCURL(ctx context.Context, chain string) (string, error) {
	chain = strings.ToLower(chain)

	// Get network from database
	network, err := s.getNetwork(ctx, chain)
	if err != nil {
		return "", fmt.Errorf("failed to get network: %w", err)
	}
	if network == nil {
		return "", fmt.Errorf("unsupported chain: %s", chain)
	}

	// For EVM chains, try Alchemy first if API key is configured
	if network.ChainType == models.ChainTypeEVM && s.alchemyAPIKey != "" {
		if baseURL, ok := alchemyURLPatterns[chain]; ok {
			return baseURL + s.alchemyAPIKey, nil
		}
	}

	// For Solana, try Alchemy if available
	if network.ChainType == models.ChainTypeSolana && s.alchemyAPIKey != "" {
		if baseURL, ok := alchemyURLPatterns[chain]; ok {
			return baseURL + s.alchemyAPIKey, nil
		}
	}

	// Use primary RPC URL from database
	rpcURL := network.RPCURL

	// If the URL contains "alchemy.com", append API key
	if s.alchemyAPIKey != "" && strings.Contains(rpcURL, "alchemy.com") {
		if !strings.HasSuffix(rpcURL, "/") {
			rpcURL += "/"
		}
		return rpcURL + s.alchemyAPIKey, nil
	}

	return rpcURL, nil
}

// GetRPCURLWithFallback returns primary and fallback RPC URLs
func (s *RPCService) GetRPCURLWithFallback(ctx context.Context, chain string) (primary string, fallback string, err error) {
	chain = strings.ToLower(chain)

	network, err := s.getNetwork(ctx, chain)
	if err != nil {
		return "", "", fmt.Errorf("failed to get network: %w", err)
	}
	if network == nil {
		return "", "", fmt.Errorf("unsupported chain: %s", chain)
	}

	primary, err = s.GetRPCURL(ctx, chain)
	if err != nil {
		return "", "", err
	}

	if network.RPCURLFallback.Valid {
		fallback = network.RPCURLFallback.String
	}

	return primary, fallback, nil
}

func (s *RPCService) Proxy(ctx context.Context, req *dto.RPCProxyRequest) (*dto.RPCResponse, error) {
	rpcURL, err := s.GetRPCURL(ctx, req.Chain)
	if err != nil {
		return nil, err
	}

	jsonrpc := req.JSONRPC
	if jsonrpc == "" {
		jsonrpc = "2.0"
	}

	id := req.ID
	if id == nil {
		id = 1
	}

	payload := map[string]interface{}{
		"jsonrpc": jsonrpc,
		"method":  req.Method,
		"params":  req.Params,
		"id":      id,
	}

	if payload["params"] == nil {
		payload["params"] = []interface{}{}
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal RPC payload: %w", err)
	}

	log.Info().
		Str("chain", req.Chain).
		Str("method", req.Method).
		Msg("RPC Proxy request")

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			return nil, fmt.Errorf("RPC request timeout")
		}
		return nil, fmt.Errorf("cannot connect to RPC provider: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Error().
			Int("status", resp.StatusCode).
			Str("body", string(body)).
			Msg("RPC provider error")
		return nil, fmt.Errorf("RPC provider error: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var rpcResp dto.RPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to parse RPC response: %w", err)
	}

	if rpcResp.Error != nil {
		log.Error().
			Int("code", rpcResp.Error.Code).
			Str("message", rpcResp.Error.Message).
			Msg("RPC error")
	}

	return &rpcResp, nil
}

func (s *RPCService) Call(ctx context.Context, chain, method string, params []interface{}) (interface{}, error) {
	req := &dto.RPCProxyRequest{
		Chain:  chain,
		Method: method,
		Params: params,
	}

	resp, err := s.Proxy(ctx, req)
	if err != nil {
		return nil, err
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("RPC error %d: %s", resp.Error.Code, resp.Error.Message)
	}

	return resp.Result, nil
}

func (s *RPCService) GetHealth(ctx context.Context) *dto.RPCHealthResponse {
	alchemyConfigured := s.alchemyAPIKey != "" && s.alchemyAPIKey != "your_alchemy_api_key_here"
	infuraConfigured := s.infuraAPIKey != "" && s.infuraAPIKey != "your_infura_key_here"

	chains := make(map[string]string)
	supportedChains := make([]string, 0)

	// Get supported chains from database
	if err := s.refreshCache(ctx); err == nil {
		s.networkCacheLock.RLock()
		for slug, network := range s.networkCache {
			supportedChains = append(supportedChains, slug)
			// Determine provider for each chain
			if alchemyConfigured {
				if _, ok := alchemyURLPatterns[slug]; ok {
					chains[slug] = "alchemy"
					continue
				}
				// Check if network's RPC URL is Alchemy
				if strings.Contains(network.RPCURL, "alchemy.com") {
					chains[slug] = "alchemy"
					continue
				}
			}
			chains[slug] = "public"
		}
		s.networkCacheLock.RUnlock()
	}

	status := "ok"
	if !alchemyConfigured && !infuraConfigured {
		status = "degraded"
	}

	return &dto.RPCHealthResponse{
		Status:          status,
		Chains:          chains,
		SupportedChains: supportedChains,
	}
}
