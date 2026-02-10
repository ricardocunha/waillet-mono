package handler

import (
	"net/http"

	"github.com/waillet-app/backend-v2/internal/service"
)

type LifiHandler struct {
	lifiService *service.LifiService
}

func NewLifiHandler(lifiService *service.LifiService) *LifiHandler {
	return &LifiHandler{lifiService: lifiService}
}

func (h *LifiHandler) GetQuote(w http.ResponseWriter, r *http.Request) {
	params := map[string]string{
		"fromChain":   r.URL.Query().Get("fromChain"),
		"toChain":     r.URL.Query().Get("toChain"),
		"fromToken":   r.URL.Query().Get("fromToken"),
		"toToken":     r.URL.Query().Get("toToken"),
		"fromAmount":  r.URL.Query().Get("fromAmount"),
		"fromAddress": r.URL.Query().Get("fromAddress"),
		"slippage":    r.URL.Query().Get("slippage"),
	}

	body, statusCode, err := h.lifiService.GetQuote(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(body)
}

func (h *LifiHandler) GetTokens(w http.ResponseWriter, r *http.Request) {
	chains := r.URL.Query().Get("chains")

	body, statusCode, err := h.lifiService.GetTokens(r.Context(), chains)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(body)
}

func (h *LifiHandler) GetChains(w http.ResponseWriter, r *http.Request) {
	body, statusCode, err := h.lifiService.GetChains(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(body)
}

func (h *LifiHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	txHash := r.URL.Query().Get("txHash")
	if txHash == "" {
		writeError(w, http.StatusBadRequest, "txHash is required")
		return
	}

	fromChain := r.URL.Query().Get("fromChain")
	toChain := r.URL.Query().Get("toChain")

	body, statusCode, err := h.lifiService.GetStatus(r.Context(), txHash, fromChain, toChain)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(body)
}
