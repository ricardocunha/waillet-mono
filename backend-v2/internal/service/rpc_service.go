package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/config"
	"github.com/waillet-app/backend-v2/internal/dto"
)

type RPCService struct {
	alchemyAPIKey string
	infuraAPIKey  string
	timeout       time.Duration
	httpClient    *http.Client
}

func NewRPCService(cfg *config.RPCConfig) *RPCService {
	return &RPCService{
		alchemyAPIKey: cfg.AlchemyAPIKey,
		infuraAPIKey:  cfg.InfuraAPIKey,
		timeout:       cfg.Timeout,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
	}
}

var alchemyChainURLs = map[string]string{
	"ethereum":     "https://eth-mainnet.g.alchemy.com/v2/",
	"sepolia":      "https://eth-sepolia.g.alchemy.com/v2/",
	"base-sepolia": "https://base-sepolia.g.alchemy.com/v2/",
	"base":         "https://base-mainnet.g.alchemy.com/v2/",
}

var fallbackURLs = map[string]string{
	"ethereum":     "https://ethereum-rpc.publicnode.com",
	"sepolia":      "https://rpc2.sepolia.org",
	"base-sepolia": "https://sepolia.base.org",
	"base":         "https://mainnet.base.org",
	"bsc":          "https://bsc-dataseed.binance.org",
	"bsc-testnet":  "https://data-seed-prebsc-1-s1.binance.org:8545",
}

var SupportedChains = []string{"ethereum", "sepolia", "base", "base-sepolia", "bsc", "bsc-testnet"}

func (s *RPCService) GetRPCURL(chain string) (string, error) {
	chain = strings.ToLower(chain)

	if s.alchemyAPIKey != "" {
		if baseURL, ok := alchemyChainURLs[chain]; ok {
			return baseURL + s.alchemyAPIKey, nil
		}
	}

	if url, ok := fallbackURLs[chain]; ok {
		if chain != "bsc" && chain != "bsc-testnet" {
			log.Warn().Str("chain", chain).Msg("No API key configured, using public endpoint (unreliable)")
		}
		return url, nil
	}

	return "", fmt.Errorf("unsupported chain: %s", chain)
}

func (s *RPCService) Proxy(ctx context.Context, req *dto.RPCProxyRequest) (*dto.RPCResponse, error) {
	rpcURL, err := s.GetRPCURL(req.Chain)
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

func (s *RPCService) GetHealth() *dto.RPCHealthResponse {
	alchemyConfigured := s.alchemyAPIKey != "" && s.alchemyAPIKey != "your_alchemy_api_key_here"
	infuraConfigured := s.infuraAPIKey != "" && s.infuraAPIKey != "your_infura_key_here"

	chains := make(map[string]string)
	for _, chain := range SupportedChains {
		if alchemyConfigured {
			if _, ok := alchemyChainURLs[chain]; ok {
				chains[chain] = "alchemy"
				continue
			}
		}
		chains[chain] = "public"
	}

	status := "ok"
	if !alchemyConfigured && !infuraConfigured {
		status = "degraded"
	}

	return &dto.RPCHealthResponse{
		Status: status,
		Chains: chains,
	}
}
