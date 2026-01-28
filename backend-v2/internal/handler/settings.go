package handler

import (
	"encoding/json"
	"net/http"

	"github.com/waillet-app/backend-v2/internal/service"
)

type SettingsHandler struct {
	aiService *service.AIService
}

func NewSettingsHandler(aiService *service.AIService) *SettingsHandler {
	return &SettingsHandler{aiService: aiService}
}

func (h *SettingsHandler) GetOpenAIStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{
		"configured": h.aiService.IsConfigured(),
	})
}

func (h *SettingsHandler) UpdateOpenAIKey(w http.ResponseWriter, r *http.Request) {
	var req struct {
		APIKey string `json:"api_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.APIKey == "" {
		writeError(w, http.StatusBadRequest, "api_key is required")
		return
	}

	h.aiService.UpdateAPIKey(req.APIKey)
	writeJSON(w, http.StatusOK, map[string]bool{"configured": true})
}
