package handler

import (
	"encoding/json"
	"net/http"

	"github.com/waillet-app/backend-v2/internal/dto"
	"github.com/waillet-app/backend-v2/internal/service"
	"github.com/waillet-app/backend-v2/pkg/validator"
)

type SimulationHandler struct {
	simulationService *service.SimulationService
	riskService       *service.RiskService
}

func NewSimulationHandler(simulationService *service.SimulationService, riskService *service.RiskService) *SimulationHandler {
	return &SimulationHandler{
		simulationService: simulationService,
		riskService:       riskService,
	}
}

func (h *SimulationHandler) SimulateTransaction(w http.ResponseWriter, r *http.Request) {
	var req dto.SimulateTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.From == "" {
		writeError(w, http.StatusBadRequest, "from address is required")
		return
	}

	if req.To == "" {
		writeError(w, http.StatusBadRequest, "to address is required")
		return
	}

	chain := req.Chain
	if chain == "" {
		chain = "ethereum"
	}

	value := req.Value
	if value == "" {
		value = "0x0"
	}

	data := req.Data
	if data == "" {
		data = "0x"
	}

	response := h.simulationService.SimulateTransaction(r.Context(), chain, req.From, req.To, value, data, req.Token)
	writeJSON(w, http.StatusOK, response)
}

func (h *SimulationHandler) RiskAnalysis(w http.ResponseWriter, r *http.Request) {
	var req dto.RiskAnalysisRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.From == "" {
		writeError(w, http.StatusBadRequest, "from address is required")
		return
	}

	if req.To == "" {
		writeError(w, http.StatusBadRequest, "to address is required")
		return
	}

	if !validator.IsValidEthereumAddress(req.To) {
		writeError(w, http.StatusBadRequest, "invalid to address")
		return
	}

	chain := req.Chain
	if chain == "" {
		chain = "ethereum"
	}

	value := req.Value
	if value == "" {
		value = "0x0"
	}

	data := req.Data
	if data == "" {
		data = "0x"
	}

	response, err := h.riskService.AnalyzeTransaction(
		r.Context(),
		chain,
		req.From,
		req.To,
		value,
		data,
		req.WalletAddress,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *SimulationHandler) RiskDecision(w http.ResponseWriter, r *http.Request) {
	var req dto.RiskDecisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.LogID == 0 {
		writeError(w, http.StatusBadRequest, "log_id is required")
		return
	}

	if req.Decision == "" {
		writeError(w, http.StatusBadRequest, "decision is required")
		return
	}

	if req.Decision != "approved" && req.Decision != "blocked" {
		writeError(w, http.StatusBadRequest, "decision must be 'approved' or 'blocked'")
		return
	}

	if err := h.riskService.UpdateDecision(r.Context(), req.LogID, req.Decision, req.TxHash); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, dto.RiskDecisionResponse{
		Success: true,
		LogID:   req.LogID,
		Message: "Decision recorded",
	})
}
