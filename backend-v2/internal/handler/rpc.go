package handler

import (
	"encoding/json"
	"net/http"

	"github.com/waillet-app/backend-v2/internal/dto"
	"github.com/waillet-app/backend-v2/internal/service"
)

type RPCHandler struct {
	rpcService *service.RPCService
}

func NewRPCHandler(rpcService *service.RPCService) *RPCHandler {
	return &RPCHandler{rpcService: rpcService}
}

func (h *RPCHandler) Proxy(w http.ResponseWriter, r *http.Request) {
	var req dto.RPCProxyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Chain == "" {
		writeError(w, http.StatusBadRequest, "chain is required")
		return
	}

	if req.Method == "" {
		writeError(w, http.StatusBadRequest, "method is required")
		return
	}

	resp, err := h.rpcService.Proxy(r.Context(), &req)
	if err != nil {
		errMsg := err.Error()
		if contains(errMsg, "timeout") {
			writeError(w, http.StatusGatewayTimeout, "RPC request timeout")
			return
		}
		if contains(errMsg, "cannot connect") {
			writeError(w, http.StatusServiceUnavailable, errMsg)
			return
		}
		if contains(errMsg, "unsupported chain") {
			writeError(w, http.StatusBadRequest, errMsg)
			return
		}
		writeError(w, http.StatusInternalServerError, errMsg)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *RPCHandler) Health(w http.ResponseWriter, r *http.Request) {
	health := h.rpcService.GetHealth()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":           health.Status,
		"chains":           health.Chains,
		"supported_chains": service.SupportedChains,
		"recommended":      "Add ALCHEMY_API_KEY to .env for best reliability",
	})
}
