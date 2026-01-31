package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
	siwe "github.com/spruceid/siwe-go"
	"github.com/waillet-app/backend-v2/internal/config"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
)

type AuthService struct {
	repo   repository.AuthRepository
	config *config.AuthConfig
}

func NewAuthService(cfg *config.AuthConfig, repo repository.AuthRepository) *AuthService {
	return &AuthService{
		repo:   repo,
		config: cfg,
	}
}

func (s *AuthService) GenerateNonce(ctx context.Context, walletAddress string) (*models.AuthNonce, string, error) {
	nonce, err := generateRandomNonce()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	authNonce := &models.AuthNonce{
		WalletAddress: strings.ToLower(walletAddress),
		Nonce:         nonce,
		ExpiresAt:     time.Now().Add(s.config.NonceTTL),
	}

	if err := s.repo.CreateNonce(ctx, authNonce); err != nil {
		return nil, "", fmt.Errorf("failed to store nonce: %w", err)
	}

	message := s.buildSIWEMessage(walletAddress, nonce)

	log.Info().
		Str("wallet_address", walletAddress).
		Str("nonce", nonce).
		Msg("Generated auth nonce")

	return authNonce, message, nil
}

func (s *AuthService) buildSIWEMessage(walletAddress, nonce string) string {
	now := time.Now().UTC()
	expiry := now.Add(s.config.NonceTTL)

	return fmt.Sprintf(`%s wants you to sign in with your Ethereum account:
%s

Sign in to Waillet

URI: https://%s
Version: 1
Chain ID: 1
Nonce: %s
Issued At: %s
Expiration Time: %s`,
		s.config.Domain,
		walletAddress,
		s.config.Domain,
		nonce,
		now.Format(time.RFC3339),
		expiry.Format(time.RFC3339),
	)
}

func (s *AuthService) VerifySignature(ctx context.Context, message, signature string) (string, error) {
	siweMessage, err := siwe.ParseMessage(message)
	if err != nil {
		return "", fmt.Errorf("invalid SIWE message: %w", err)
	}

	walletAddress := siweMessage.GetAddress().Hex()
	nonce := siweMessage.GetNonce()

	storedNonce, err := s.repo.GetNonceByValue(ctx, nonce)
	if err != nil {
		return "", fmt.Errorf("failed to lookup nonce: %w", err)
	}

	if storedNonce == nil {
		return "", fmt.Errorf("nonce not found")
	}

	if !storedNonce.IsValid() {
		return "", fmt.Errorf("nonce expired or already used")
	}

	if !strings.EqualFold(storedNonce.WalletAddress, walletAddress) {
		return "", fmt.Errorf("wallet address mismatch")
	}

	_, err = siweMessage.Verify(signature, &s.config.Domain, nil, nil)
	if err != nil {
		return "", fmt.Errorf("signature verification failed: %w", err)
	}

	if err := s.repo.MarkNonceUsed(ctx, storedNonce.ID); err != nil {
		log.Error().Err(err).Int64("nonce_id", storedNonce.ID).Msg("Failed to mark nonce as used")
	}

	log.Info().
		Str("wallet_address", walletAddress).
		Msg("Signature verified successfully")

	return walletAddress, nil
}

func (s *AuthService) GenerateTokens(walletAddress string) (accessToken, refreshToken string, expiresIn int64, err error) {
	now := time.Now()

	accessClaims := &Claims{
		WalletAddress: strings.ToLower(walletAddress),
		TokenType:     TokenTypeAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.config.AccessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    s.config.Domain,
			Subject:   strings.ToLower(walletAddress),
		},
	}

	accessTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err = accessTokenObj.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return "", "", 0, fmt.Errorf("failed to sign access token: %w", err)
	}

	refreshClaims := &Claims{
		WalletAddress: strings.ToLower(walletAddress),
		TokenType:     TokenTypeRefresh,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.config.RefreshTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    s.config.Domain,
			Subject:   strings.ToLower(walletAddress),
		},
	}

	refreshTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err = refreshTokenObj.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return "", "", 0, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	expiresIn = int64(s.config.AccessTokenTTL.Seconds())

	log.Info().
		Str("wallet_address", walletAddress).
		Msg("Generated JWT tokens")

	return accessToken, refreshToken, expiresIn, nil
}

func (s *AuthService) RefreshAccessToken(refreshToken string) (newAccessToken, newRefreshToken string, expiresIn int64, err error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(refreshToken, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		return "", "", 0, fmt.Errorf("invalid refresh token: %w", err)
	}

	if !token.Valid {
		return "", "", 0, fmt.Errorf("invalid refresh token")
	}

	if claims.TokenType != TokenTypeRefresh {
		return "", "", 0, fmt.Errorf("invalid token type")
	}

	return s.GenerateTokens(claims.WalletAddress)
}

func (s *AuthService) ValidateAccessToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	if claims.TokenType != TokenTypeAccess {
		return nil, fmt.Errorf("invalid token type")
	}

	return claims, nil
}

func generateRandomNonce() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
