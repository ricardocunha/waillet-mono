package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/auth"
	"github.com/waillet-app/backend-v2/internal/dto"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/service"
)

type DocumentShareHandler struct {
	service *service.DocumentShareService
}

func NewDocumentShareHandler(svc *service.DocumentShareService) *DocumentShareHandler {
	return &DocumentShareHandler{service: svc}
}

func (h *DocumentShareHandler) InitiateShare(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	idStr := chi.URLParam(r, "id")
	docID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document id")
		return
	}

	var req dto.InitiateShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if !isValidAddress(req.RecipientAddress) {
		writeError(w, http.StatusBadRequest, "invalid recipient address")
		return
	}

	expiresAt := time.Unix(req.ExpiresAt, 0)

	share, docHash, err := h.service.InitiateShare(r.Context(), walletAddress, docID, req.RecipientAddress, expiresAt)
	if err != nil {
		if strings.Contains(err.Error(), "not authorized") {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Error().Err(err).Msg("Failed to initiate share")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, dto.InitiateShareResponse{
		ShareID:      share.ID,
		DocumentHash: docHash,
	})
}

func (h *DocumentShareHandler) ConfirmShare(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	shareIDStr := chi.URLParam(r, "shareId")
	shareID, err := strconv.ParseInt(shareIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid share id")
		return
	}

	var req dto.ConfirmShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.ConfirmShare(r.Context(), shareID, req.TokenID, req.TxHash); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Error().Err(err).Msg("Failed to confirm share")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "share confirmed",
	})
}

func (h *DocumentShareHandler) GetDocumentShares(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	idStr := chi.URLParam(r, "id")
	docID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid document id")
		return
	}

	shares, err := h.service.GetDocumentShares(r.Context(), docID, walletAddress)
	if err != nil {
		if strings.Contains(err.Error(), "not authorized") {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Error().Err(err).Msg("Failed to get document shares")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := make([]dto.DocumentShareResponse, len(shares))
	for i, s := range shares {
		response[i] = toDocumentShareResponse(&s)
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *DocumentShareHandler) GetSharedWithMe(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	views, err := h.service.GetSharedWithMe(r.Context(), walletAddress)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get shared documents")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := make([]dto.SharedDocumentViewDTO, 0, len(views))
	for _, v := range views {
		response = append(response, dto.SharedDocumentViewDTO{
			Share: toDocumentShareResponse(&v.Share),
			Document: dto.SharedDocumentInfo{
				ID:           v.Document.ID,
				Title:        v.Document.Title,
				FileName:     v.Document.FileName,
				FileType:     v.Document.FileType,
				FileSize:     v.Document.FileSize,
				DocumentType: nullStringPtr(v.Document.DocumentType),
				CreatedAt:    v.Document.CreatedAt,
			},
		})
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *DocumentShareHandler) RevokeShare(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	shareIDStr := chi.URLParam(r, "shareId")
	shareID, err := strconv.ParseInt(shareIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid share id")
		return
	}

	if err := h.service.RevokeShare(r.Context(), shareID, walletAddress); err != nil {
		if strings.Contains(err.Error(), "not authorized") {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Error().Err(err).Msg("Failed to revoke share")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "share revoked",
	})
}

func (h *DocumentShareHandler) ConfirmRevoke(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	shareIDStr := chi.URLParam(r, "shareId")
	shareID, err := strconv.ParseInt(shareIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid share id")
		return
	}

	var req dto.ConfirmRevokeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.ConfirmRevoke(r.Context(), shareID, req.TxHash); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Error().Err(err).Msg("Failed to confirm revoke")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "revoke confirmed",
	})
}

func (h *DocumentShareHandler) GetSharedDocumentURL(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	shareIDStr := chi.URLParam(r, "shareId")
	shareID, err := strconv.ParseInt(shareIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid share id")
		return
	}

	url, err := h.service.GetSharedDocumentURL(r.Context(), shareID, walletAddress)
	if err != nil {
		if strings.Contains(err.Error(), "not authorized") {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "not active") || strings.Contains(err.Error(), "expired") {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Error().Err(err).Msg("Failed to get shared document URL")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

// Helper functions

func isValidAddress(addr string) bool {
	if len(addr) != 42 {
		return false
	}
	if !strings.HasPrefix(addr, "0x") {
		return false
	}
	for _, c := range addr[2:] {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

func toDocumentShareResponse(share *models.DocumentShare) dto.DocumentShareResponse {
	resp := dto.DocumentShareResponse{
		ID:               share.ID,
		DocumentID:       share.DocumentID,
		DocumentHash:     share.DocumentHash,
		OwnerAddress:     share.OwnerAddress,
		RecipientAddress: share.RecipientAddress,
		ExpiresAt:        share.ExpiresAt,
		Status:           string(share.Status),
		CreatedAt:        share.CreatedAt,
		UpdatedAt:        share.UpdatedAt,
	}
	if share.TokenID.Valid {
		tokenID := share.TokenID.Int64
		resp.TokenID = &tokenID
	}
	if share.TxHash.Valid {
		resp.TxHash = &share.TxHash.String
	}
	if share.RevokeTxHash.Valid {
		resp.RevokeTxHash = &share.RevokeTxHash.String
	}
	return resp
}

func nullStringPtr(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}
