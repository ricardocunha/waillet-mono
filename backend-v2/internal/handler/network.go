package handler

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
)

type NetworkHandler struct {
	repo repository.NetworkRepository
}

func NewNetworkHandler(repo repository.NetworkRepository) *NetworkHandler {
	return &NetworkHandler{repo: repo}
}

// GetAll returns all active networks
func (h *NetworkHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	networks, err := h.repo.GetActive(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("Failed to get networks")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := make([]models.NetworkResponse, len(networks))
	for i, n := range networks {
		response[i] = n.ToResponse()
	}

	log.Debug().Int("count", len(networks)).Msg("Returning networks")
	writeJSON(w, http.StatusOK, response)
}

// GetBySlug returns a network by its slug
func (h *NetworkHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	network, err := h.repo.GetBySlug(r.Context(), slug)
	if err != nil {
		log.Error().Err(err).Str("slug", slug).Msg("Failed to get network")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if network == nil {
		writeError(w, http.StatusNotFound, "network not found")
		return
	}

	writeJSON(w, http.StatusOK, network.ToResponse())
}

// GetByChainID returns a network by its chain ID
func (h *NetworkHandler) GetByChainID(w http.ResponseWriter, r *http.Request) {
	chainIDStr := chi.URLParam(r, "chain_id")
	var chainID int
	if _, err := fmt.Sscanf(chainIDStr, "%d", &chainID); err != nil {
		writeError(w, http.StatusBadRequest, "invalid chain_id")
		return
	}

	network, err := h.repo.GetByChainID(r.Context(), chainID)
	if err != nil {
		log.Error().Err(err).Int("chain_id", chainID).Msg("Failed to get network")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if network == nil {
		writeError(w, http.StatusNotFound, "network not found")
		return
	}

	writeJSON(w, http.StatusOK, network.ToResponse())
}
