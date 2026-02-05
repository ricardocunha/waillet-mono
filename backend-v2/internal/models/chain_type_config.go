package models

import (
	"time"
)

// ChainTypeConfig represents cryptographic configuration for a chain type
type ChainTypeConfig struct {
	ID                 string    `db:"id" json:"id"`                                   // 'evm', 'solana', 'sui', 'ton'
	Name               string    `db:"name" json:"name"`                               // Display name
	CoinType           int       `db:"coin_type" json:"coin_type"`                     // BIP-44 coin type
	Curve              string    `db:"curve" json:"curve"`                             // 'secp256k1' or 'ed25519'
	AddressFormat      string    `db:"address_format" json:"address_format"`           // 'hex', 'base58', 'base64url'
	DerivationTemplate string    `db:"derivation_template" json:"derivation_template"` // Path with {index} placeholder
	IsActive           bool      `db:"is_active" json:"is_active"`
	SortOrder          int       `db:"sort_order" json:"sort_order"`
	CreatedAt          time.Time `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time `db:"updated_at" json:"updated_at"`
}

// ChainTypeConfigResponse is the JSON response for chain type config data
type ChainTypeConfigResponse struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	CoinType           int    `json:"coin_type"`
	Curve              string `json:"curve"`
	AddressFormat      string `json:"address_format"`
	DerivationTemplate string `json:"derivation_template"`
}

func (c *ChainTypeConfig) ToResponse() ChainTypeConfigResponse {
	return ChainTypeConfigResponse{
		ID:                 c.ID,
		Name:               c.Name,
		CoinType:           c.CoinType,
		Curve:              c.Curve,
		AddressFormat:      c.AddressFormat,
		DerivationTemplate: c.DerivationTemplate,
	}
}
