package auth

import (
	"github.com/golang-jwt/jwt/v5"
)

type TokenType string

const (
	TokenTypeAccess  TokenType = "access"
	TokenTypeRefresh TokenType = "refresh"
)

type Claims struct {
	WalletAddress string    `json:"wallet_address"`
	TokenType     TokenType `json:"token_type"`
	jwt.RegisteredClaims
}
