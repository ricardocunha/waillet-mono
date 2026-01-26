package models

import (
	"database/sql"
	"time"
)

type FavoriteType string

const (
	FavoriteTypeAddress  FavoriteType = "address"
	FavoriteTypeContract FavoriteType = "contract"
	FavoriteTypeToken    FavoriteType = "token"
)

type Favorite struct {
	ID            int64          `db:"id" json:"id"`
	WalletAddress string         `db:"wallet_address" json:"wallet_address"`
	Alias         string         `db:"alias" json:"alias"`
	Address       string         `db:"address" json:"address"`
	Asset         sql.NullString `db:"asset" json:"asset,omitempty"`
	Type          FavoriteType   `db:"type" json:"type"`
	Value         sql.NullString `db:"value" json:"value,omitempty"`
	CreatedAt     time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time      `db:"updated_at" json:"updated_at"`
}

func (f *Favorite) AssetValue() *string {
	if f.Asset.Valid {
		return &f.Asset.String
	}
	return nil
}

func (f *Favorite) ValueString() *string {
	if f.Value.Valid {
		return &f.Value.String
	}
	return nil
}
