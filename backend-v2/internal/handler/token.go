package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
	"github.com/waillet-app/backend-v2/internal/service"
)

type TokenHandler struct {
	repo       repository.TokenRepository
	cmcService *service.CoinMarketCapService
}

func NewTokenHandler(repo repository.TokenRepository, cmcService *service.CoinMarketCapService) *TokenHandler {
	return &TokenHandler{
		repo:       repo,
		cmcService: cmcService,
	}
}

// GetAll returns all tokens (top 100 by market cap)
func (h *TokenHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	tokens, err := h.repo.GetAll(r.Context(), limit)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get tokens")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := make([]models.TokenResponse, len(tokens))
	for i, t := range tokens {
		response[i] = t.ToResponse()
	}

	log.Debug().Int("count", len(tokens)).Msg("Returning tokens")
	writeJSON(w, http.StatusOK, response)
}

// GetBySymbol returns a token by its symbol with all network addresses
func (h *TokenHandler) GetBySymbol(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")

	token, err := h.repo.GetTokenWithAddresses(r.Context(), symbol)
	if err != nil {
		log.Error().Err(err).Str("symbol", symbol).Msg("Failed to get token")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if token == nil {
		writeError(w, http.StatusNotFound, "token not found")
		return
	}

	writeJSON(w, http.StatusOK, token)
}

// GetByNetwork returns all tokens available on a specific network
func (h *TokenHandler) GetByNetwork(w http.ResponseWriter, r *http.Request) {
	networkSlug := chi.URLParam(r, "network_slug")

	tokens, err := h.repo.GetTokensForNetwork(r.Context(), networkSlug)
	if err != nil {
		log.Error().Err(err).Str("network", networkSlug).Msg("Failed to get tokens for network")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Convert to response format
	response := make([]models.TokenWithAddresses, len(tokens))
	for i, t := range tokens {
		response[i] = models.TokenWithAddresses{
			Token: t.Token.ToResponse(),
			Addresses: map[string]models.TokenAddressDTO{
				t.NetworkSlug: {
					ContractAddress: t.ContractAddress,
					Decimals:        t.Decimals,
					IsNative:        t.IsNative,
				},
			},
		}
	}

	log.Debug().Str("network", networkSlug).Int("count", len(tokens)).Msg("Returning tokens for network")
	writeJSON(w, http.StatusOK, response)
}

// GetPrices returns prices for multiple tokens
func (h *TokenHandler) GetPrices(w http.ResponseWriter, r *http.Request) {
	symbolsStr := r.URL.Query().Get("symbols")
	if symbolsStr == "" {
		writeError(w, http.StatusBadRequest, "symbols parameter required")
		return
	}

	symbols := strings.Split(symbolsStr, ",")
	for i, s := range symbols {
		symbols[i] = strings.TrimSpace(s)
	}

	prices, err := h.cmcService.GetPrices(r.Context(), symbols)
	if err != nil {
		log.Error().Err(err).Strs("symbols", symbols).Msg("Failed to get prices")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	log.Debug().Int("count", len(prices)).Msg("Returning token prices")
	writeJSON(w, http.StatusOK, prices)
}

// TriggerSync manually triggers a sync with CoinMarketCap
func (h *TokenHandler) TriggerSync(w http.ResponseWriter, r *http.Request) {
	if !h.cmcService.IsConfigured() {
		writeError(w, http.StatusServiceUnavailable, "CoinMarketCap API not configured")
		return
	}

	if err := h.cmcService.SyncTokens(r.Context()); err != nil {
		log.Error().Err(err).Msg("Failed to sync tokens")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	log.Info().Msg("Manual token sync completed")
	writeJSON(w, http.StatusOK, map[string]string{"status": "synced"})
}
