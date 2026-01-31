package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/auth"
	"github.com/waillet-app/backend-v2/internal/dto"
	"github.com/waillet-app/backend-v2/pkg/validator"
)

type AuthHandler struct {
	authService *auth.AuthService
}

func NewAuthHandler(authService *auth.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) GetNonce(w http.ResponseWriter, r *http.Request) {
	walletAddress := r.URL.Query().Get("wallet_address")
	if walletAddress == "" {
		writeError(w, http.StatusBadRequest, "wallet_address is required")
		return
	}

	if !validator.IsValidEthereumAddress(walletAddress) {
		writeError(w, http.StatusBadRequest, "invalid wallet address")
		return
	}

	_, message, err := h.authService.GenerateNonce(r.Context(), walletAddress)
	if err != nil {
		log.Error().Err(err).Str("wallet_address", walletAddress).Msg("Failed to generate nonce")
		writeError(w, http.StatusInternalServerError, "failed to generate nonce")
		return
	}

	response := dto.NonceResponse{
		Nonce:   extractNonceFromMessage(message),
		Message: message,
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *AuthHandler) VerifySignature(w http.ResponseWriter, r *http.Request) {
	var req dto.VerifySignatureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Message == "" {
		writeError(w, http.StatusBadRequest, "message is required")
		return
	}

	if req.Signature == "" {
		writeError(w, http.StatusBadRequest, "signature is required")
		return
	}

	walletAddress, err := h.authService.VerifySignature(r.Context(), req.Message, req.Signature)
	if err != nil {
		log.Warn().Err(err).Msg("Signature verification failed")
		writeError(w, http.StatusUnauthorized, "signature verification failed")
		return
	}

	accessToken, refreshToken, expiresIn, err := h.authService.GenerateTokens(walletAddress)
	if err != nil {
		log.Error().Err(err).Str("wallet_address", walletAddress).Msg("Failed to generate tokens")
		writeError(w, http.StatusInternalServerError, "failed to generate tokens")
		return
	}

	response := dto.AuthTokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    expiresIn,
		TokenType:    "Bearer",
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req dto.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	accessToken, refreshToken, expiresIn, err := h.authService.RefreshAccessToken(req.RefreshToken)
	if err != nil {
		log.Warn().Err(err).Msg("Token refresh failed")
		writeError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	response := dto.AuthTokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    expiresIn,
		TokenType:    "Bearer",
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	response := dto.CurrentUserResponse{
		WalletAddress: walletAddress,
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "logged out successfully",
	})
}

func extractNonceFromMessage(message string) string {
	lines := splitLines(message)
	for _, line := range lines {
		if len(line) > 7 && line[:7] == "Nonce: " {
			return line[7:]
		}
	}
	return ""
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}
