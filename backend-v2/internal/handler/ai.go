package handler

import (
	"encoding/json"
	"net/http"

	"github.com/waillet-app/backend-go/internal/dto"
	"github.com/waillet-app/backend-go/internal/service"
	"github.com/waillet-app/backend-go/pkg/validator"
)

type AIHandler struct {
	aiService *service.AIService
}

func NewAIHandler(aiService *service.AIService) *AIHandler {
	return &AIHandler{aiService: aiService}
}

func (h *AIHandler) ParseIntent(w http.ResponseWriter, r *http.Request) {
	var req dto.ParseIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "prompt is required")
		return
	}

	if req.WalletAddress == "" {
		writeError(w, http.StatusBadRequest, "wallet_address is required")
		return
	}

	if !validator.IsValidEthereumAddress(req.WalletAddress) {
		writeError(w, http.StatusBadRequest, "invalid wallet address")
		return
	}

	response, err := h.aiService.ParseIntent(r.Context(), req.Prompt, req.WalletAddress)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, response)
}
