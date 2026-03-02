package models

import (
	"database/sql"
	"time"
)

type ShareStatus string

const (
	ShareStatusPending ShareStatus = "pending"
	ShareStatusActive  ShareStatus = "active"
	ShareStatusRevoked ShareStatus = "revoked"
	ShareStatusExpired ShareStatus = "expired"
)

type DocumentShare struct {
	ID               int64          `db:"id" json:"id"`
	DocumentID       int64          `db:"document_id" json:"document_id"`
	DocumentHash     string         `db:"document_hash" json:"document_hash"`
	OwnerAddress     string         `db:"owner_address" json:"owner_address"`
	RecipientAddress string         `db:"recipient_address" json:"recipient_address"`
	TokenID          sql.NullInt64  `db:"token_id" json:"token_id"`
	TxHash           sql.NullString `db:"tx_hash" json:"tx_hash"`
	ExpiresAt        time.Time      `db:"expires_at" json:"expires_at"`
	Status           ShareStatus    `db:"status" json:"status"`
	RevokeTxHash     sql.NullString `db:"revoke_tx_hash" json:"revoke_tx_hash"`
	CreatedAt        time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time      `db:"updated_at" json:"updated_at"`
}
