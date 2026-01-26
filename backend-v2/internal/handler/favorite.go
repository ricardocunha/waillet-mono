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

type FavoriteHandler struct {
	repo repository.FavoriteRepository
}

func NewFavoriteHandler(repo repository.FavoriteRepository) *FavoriteHandler {
	return &FavoriteHandler{repo: repo}
}

func (h *FavoriteHandler) GetByWallet(w http.ResponseWriter, r *http.Request) {
	walletAddress := chi.URLParam(r, "wallet_address")
	if !validator.IsValidEthereumAddress(walletAddress) {
		writeError(w, http.StatusBadRequest, "invalid wallet address")
		return
	}

	favorites, err := h.repo.GetByWalletAddress(r.Context(), walletAddress)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := make([]dto.FavoriteResponse, len(favorites))
	for i, f := range favorites {
		response[i] = toFavoriteResponse(&f)
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *FavoriteHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateFavoriteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if !validator.IsValidEthereumAddress(req.WalletAddress) {
		writeError(w, http.StatusBadRequest, "invalid wallet address")
		return
	}

	if !validator.IsValidEthereumAddress(req.Address) {
		writeError(w, http.StatusBadRequest, "invalid address")
		return
	}

	if req.Alias == "" {
		writeError(w, http.StatusBadRequest, "alias is required")
		return
	}

	if req.Chain == "" {
		writeError(w, http.StatusBadRequest, "chain is required")
		return
	}

	favoriteType := models.FavoriteTypeAddress
	if req.Type != "" {
		favoriteType = models.FavoriteType(req.Type)
	}

	favorite := &models.Favorite{
		WalletAddress: req.WalletAddress,
		Alias:         req.Alias,
		Address:       req.Address,
		Chain:         req.Chain,
		Type:          favoriteType,
	}

	if req.Asset != nil {
		favorite.Asset = sql.NullString{String: *req.Asset, Valid: true}
	}

	if req.Value != nil {
		favorite.Value = sql.NullString{String: *req.Value, Valid: true}
	}

	if err := h.repo.Create(r.Context(), favorite); err != nil {
		if isDuplicateKeyError(err) {
			writeError(w, http.StatusConflict, "favorite with this alias already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, toFavoriteResponse(favorite))
}

func (h *FavoriteHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var req dto.UpdateFavoriteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	favorite, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if favorite == nil {
		writeError(w, http.StatusNotFound, "favorite not found")
		return
	}

	if req.Alias != nil {
		favorite.Alias = *req.Alias
	}
	if req.Address != nil {
		if !validator.IsValidEthereumAddress(*req.Address) {
			writeError(w, http.StatusBadRequest, "invalid address")
			return
		}
		favorite.Address = *req.Address
	}
	if req.Chain != nil {
		favorite.Chain = *req.Chain
	}
	if req.Asset != nil {
		favorite.Asset = sql.NullString{String: *req.Asset, Valid: true}
	}
	if req.Type != nil {
		favorite.Type = models.FavoriteType(*req.Type)
	}
	if req.Value != nil {
		favorite.Value = sql.NullString{String: *req.Value, Valid: true}
	}

	if err := h.repo.Update(r.Context(), favorite); err != nil {
		if isDuplicateKeyError(err) {
			writeError(w, http.StatusConflict, "favorite with this alias already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, toFavoriteResponse(favorite))
}

func (h *FavoriteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	favorite, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if favorite == nil {
		writeError(w, http.StatusNotFound, "favorite not found")
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "favorite deleted",
	})
}

func toFavoriteResponse(f *models.Favorite) dto.FavoriteResponse {
	resp := dto.FavoriteResponse{
		ID:            f.ID,
		WalletAddress: f.WalletAddress,
		Alias:         f.Alias,
		Address:       f.Address,
		Chain:         f.Chain,
		Type:          string(f.Type),
		CreatedAt:     f.CreatedAt,
		UpdatedAt:     f.UpdatedAt,
	}

	if f.Asset.Valid {
		resp.Asset = &f.Asset.String
	}
	if f.Value.Valid {
		resp.Value = &f.Value.String
	}

	return resp
}

func isDuplicateKeyError(err error) bool {
	return err != nil && (contains(err.Error(), "Duplicate entry") || contains(err.Error(), "unique constraint"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
