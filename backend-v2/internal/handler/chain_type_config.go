package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
)

type ChainTypeConfigHandler struct {
	repo repository.ChainTypeConfigRepository
}

func NewChainTypeConfigHandler(repo repository.ChainTypeConfigRepository) *ChainTypeConfigHandler {
	return &ChainTypeConfigHandler{repo: repo}
}

// GetAll returns all active chain type configs
func (h *ChainTypeConfigHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	configs, err := h.repo.GetActive(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("Failed to get chain type configs")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := make([]models.ChainTypeConfigResponse, len(configs))
	for i, c := range configs {
		response[i] = c.ToResponse()
	}

	log.Debug().Int("count", len(configs)).Msg("Returning chain type configs")
	writeJSON(w, http.StatusOK, response)
}

// GetByID returns a chain type config by its ID
func (h *ChainTypeConfigHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	config, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		log.Error().Err(err).Str("id", id).Msg("Failed to get chain type config")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if config == nil {
		writeError(w, http.StatusNotFound, "chain type config not found")
		return
	}

	writeJSON(w, http.StatusOK, config.ToResponse())
}
