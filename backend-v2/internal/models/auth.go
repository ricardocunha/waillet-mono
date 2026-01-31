package models

import "time"

type AuthNonce struct {
	ID            int64     `db:"id" json:"id"`
	WalletAddress string    `db:"wallet_address" json:"wallet_address"`
	Nonce         string    `db:"nonce" json:"nonce"`
	ExpiresAt     time.Time `db:"expires_at" json:"expires_at"`
	Used          bool      `db:"used" json:"used"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

func (n *AuthNonce) IsExpired() bool {
	return time.Now().After(n.ExpiresAt)
}

func (n *AuthNonce) IsValid() bool {
	return !n.Used && !n.IsExpired()
}
