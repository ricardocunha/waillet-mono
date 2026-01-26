package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/waillet-app/backend-v2/internal/dto"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
	"github.com/waillet-app/backend-v2/pkg/validator"
)

type PolicyHandler struct {
	repo repository.PolicyRepository
}

func NewPolicyHandler(repo repository.PolicyRepository) *PolicyHandler {
	return &PolicyHandler{repo: repo}
}

func (h *PolicyHandler) GetByWallet(w http.ResponseWriter, r *http.Request) {
	walletAddress := chi.URLParam(r, "wallet_address")
	if !validator.IsValidEthereumAddress(walletAddress) {
		writeError(w, http.StatusBadRequest, "invalid wallet address")
		return
	}

	policies, err := h.repo.GetByWalletAddress(r.Context(), walletAddress)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := make([]dto.PolicyResponse, len(policies))
	for i, p := range policies {
		response[i] = toPolicyResponse(&p)
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *PolicyHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreatePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if !validator.IsValidEthereumAddress(req.WalletAddress) {
		writeError(w, http.StatusBadRequest, "invalid wallet address")
		return
	}

	if req.TargetAddress != nil && !validator.IsValidEthereumAddress(*req.TargetAddress) {
		writeError(w, http.StatusBadRequest, "invalid target address")
		return
	}

	if req.PolicyType == "" {
		writeError(w, http.StatusBadRequest, "policy_type is required")
		return
	}

	policyType := models.PolicyType(req.PolicyType)
	if policyType != models.PolicyTypeAllowlist &&
		policyType != models.PolicyTypeSpendingLimit &&
		policyType != models.PolicyTypeContractBlock {
		writeError(w, http.StatusBadRequest, "invalid policy_type")
		return
	}

	if req.Chain == "" {
		writeError(w, http.StatusBadRequest, "chain is required")
		return
	}

	policy := &models.Policy{
		WalletAddress: req.WalletAddress,
		PolicyType:    policyType,
		Chain:         req.Chain,
		IsActive:      true,
	}

	if req.TargetAddress != nil {
		policy.TargetAddress = sql.NullString{String: *req.TargetAddress, Valid: true}
	}

	if req.LimitAmount != nil {
		policy.LimitAmount = sql.NullFloat64{Float64: *req.LimitAmount, Valid: true}
	}

	if err := h.repo.Create(r.Context(), policy); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, toPolicyResponse(policy))
}

func (h *PolicyHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	policy, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if policy == nil {
		writeError(w, http.StatusNotFound, "policy not found")
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "policy deactivated",
	})
}

func toPolicyResponse(p *models.Policy) dto.PolicyResponse {
	resp := dto.PolicyResponse{
		ID:            p.ID,
		WalletAddress: p.WalletAddress,
		PolicyType:    string(p.PolicyType),
		Chain:         p.Chain,
		IsActive:      p.IsActive,
		CreatedAt:     p.CreatedAt,
		UpdatedAt:     p.UpdatedAt,
	}

	if p.TargetAddress.Valid {
		resp.TargetAddress = &p.TargetAddress.String
	}
	if p.LimitAmount.Valid {
		resp.LimitAmount = &p.LimitAmount.Float64
	}

	return resp
}
