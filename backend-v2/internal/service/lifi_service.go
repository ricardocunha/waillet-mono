package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/waillet-app/backend-v2/internal/config"
)

type LifiService struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

func NewLifiService(cfg *config.LifiConfig) *LifiService {
	return &LifiService{
		apiKey:  cfg.APIKey,
		baseURL: cfg.BaseURL,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *LifiService) doRequest(ctx context.Context, path string, query map[string]string) ([]byte, int, error) {
	url := fmt.Sprintf("%s%s", s.baseURL, path)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	if s.apiKey != "" {
		req.Header.Set("x-lifi-api-key", s.apiKey)
	}
	req.Header.Set("Accept", "application/json")

	q := req.URL.Query()
	for k, v := range query {
		if v != "" {
			q.Set(k, v)
		}
	}
	req.URL.RawQuery = q.Encode()

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return body, resp.StatusCode, nil
}

func (s *LifiService) GetQuote(ctx context.Context, params map[string]string) ([]byte, int, error) {
	return s.doRequest(ctx, "/quote", params)
}

func (s *LifiService) GetTokens(ctx context.Context, chains string) ([]byte, int, error) {
	query := map[string]string{}
	if chains != "" {
		query["chains"] = chains
	}
	return s.doRequest(ctx, "/tokens", query)
}

func (s *LifiService) GetChains(ctx context.Context) ([]byte, int, error) {
	return s.doRequest(ctx, "/chains", nil)
}

func (s *LifiService) GetStatus(ctx context.Context, txHash, fromChain, toChain string) ([]byte, int, error) {
	query := map[string]string{
		"txHash": txHash,
	}
	if fromChain != "" {
		query["fromChain"] = fromChain
	}
	if toChain != "" {
		query["toChain"] = toChain
	}
	return s.doRequest(ctx, "/status", query)
}
