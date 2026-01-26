package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type ScamInfo struct {
	Reason  string `json:"reason"`
	Source  string `json:"source"`
	Reports int    `json:"reports"`
}

type scamCacheEntry struct {
	IsScam    bool
	Info      *ScamInfo
	Timestamp time.Time
}

type ScamService struct {
	httpClient *http.Client
	timeout    time.Duration
	blacklist  map[string]bool
	cache      map[string]*scamCacheEntry
	cacheMu    sync.RWMutex
}

func NewScamService() *ScamService {
	return &ScamService{
		httpClient: &http.Client{Timeout: 2 * time.Second},
		timeout:    2 * time.Second,
		blacklist: map[string]bool{
			"0x0000000000000000000000000000000000000000": true,
		},
		cache: make(map[string]*scamCacheEntry),
	}
}

func (s *ScamService) IsScam(ctx context.Context, address, chain string) (bool, *ScamInfo) {
	addressLower := strings.ToLower(address)

	s.cacheMu.RLock()
	if cached, ok := s.cache[addressLower]; ok {
		if time.Since(cached.Timestamp) < 24*time.Hour {
			s.cacheMu.RUnlock()
			log.Debug().Str("address", address[:10]).Bool("is_scam", cached.IsScam).Msg("Scam check (cached)")
			return cached.IsScam, cached.Info
		}
	}
	s.cacheMu.RUnlock()

	if s.blacklist[addressLower] {
		info := &ScamInfo{
			Reason:  "Manually blacklisted address",
			Source:  "local",
			Reports: 1,
		}
		s.cacheResult(addressLower, true, info)
		log.Warn().Str("address", address[:10]).Msg("Scam detected (local blacklist)")
		return true, info
	}

	isScam, info := s.checkChainAbuse(ctx, address, chain)
	if isScam {
		s.cacheResult(addressLower, true, info)
		log.Warn().Str("address", address[:10]).Msg("Scam detected (ChainAbuse)")
		return true, info
	}

	s.cacheResult(addressLower, false, nil)
	log.Debug().Str("address", address[:10]).Msg("Address clean")
	return false, nil
}

func (s *ScamService) checkChainAbuse(ctx context.Context, address, chain string) (bool, *ScamInfo) {
	chainName := s.normalizeChainName(chain)
	url := fmt.Sprintf("https://www.chainabuse.com/api/v1/check?address=%s&chain=%s", address, chainName)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create ChainAbuse request")
		return false, nil
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Warn().Err(err).Msg("ChainAbuse API request failed")
		return false, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}

	if resp.StatusCode != http.StatusOK {
		log.Warn().Int("status", resp.StatusCode).Msg("ChainAbuse API returned non-200")
		return false, nil
	}

	var data struct {
		Reported bool   `json:"reported"`
		Count    int    `json:"count"`
		Category string `json:"category"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Warn().Err(err).Msg("Failed to decode ChainAbuse response")
		return false, nil
	}

	if data.Reported || data.Count > 0 {
		category := data.Category
		if category == "" {
			category = "fraudulent activity"
		}
		reports := data.Count
		if reports == 0 {
			reports = 1
		}
		return true, &ScamInfo{
			Reason:  category,
			Source:  "ChainAbuse.com",
			Reports: reports,
		}
	}

	return false, nil
}

func (s *ScamService) normalizeChainName(chain string) string {
	chainMap := map[string]string{
		"ethereum": "ethereum",
		"sepolia":  "ethereum",
		"mainnet":  "ethereum",
		"polygon":  "polygon",
		"bsc":      "binance-smart-chain",
		"arbitrum": "arbitrum",
		"optimism": "optimism",
	}
	if normalized, ok := chainMap[strings.ToLower(chain)]; ok {
		return normalized
	}
	return "ethereum"
}

func (s *ScamService) cacheResult(address string, isScam bool, info *ScamInfo) {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	s.cache[address] = &scamCacheEntry{
		IsScam:    isScam,
		Info:      info,
		Timestamp: time.Now(),
	}
}

func (s *ScamService) AddToBlacklist(address, reason string) {
	addressLower := strings.ToLower(address)
	s.blacklist[addressLower] = true

	s.cacheResult(addressLower, true, &ScamInfo{
		Reason:  reason,
		Source:  "local",
		Reports: 1,
	})
	log.Info().Str("address", address).Str("reason", reason).Msg("Added to blacklist")
}

func (s *ScamService) RemoveFromBlacklist(address string) {
	addressLower := strings.ToLower(address)
	delete(s.blacklist, addressLower)

	s.cacheMu.Lock()
	delete(s.cache, addressLower)
	s.cacheMu.Unlock()

	log.Info().Str("address", address).Msg("Removed from blacklist")
}
