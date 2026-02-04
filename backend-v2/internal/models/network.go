package models

import (
	"database/sql"
	"time"
)

// ChainType represents the blockchain type
type ChainType string

const (
	ChainTypeEVM    ChainType = "evm"
	ChainTypeSolana ChainType = "solana"
	ChainTypeSUI    ChainType = "sui"
	ChainTypeTON    ChainType = "ton"
)

type Network struct {
	ID                     int64          `db:"id" json:"id"`
	Slug                   string         `db:"slug" json:"slug"`
	ChainType              ChainType      `db:"chain_type" json:"chain_type"`
	Name                   string         `db:"name" json:"name"`
	ChainID                sql.NullInt64  `db:"chain_id" json:"chain_id,omitempty"`
	RPCURL                 string         `db:"rpc_url" json:"rpc_url"`
	RPCURLFallback         sql.NullString `db:"rpc_url_fallback" json:"rpc_url_fallback,omitempty"`
	ExplorerURL            string         `db:"explorer_url" json:"explorer_url"`
	NativeCurrencySymbol   string         `db:"native_currency_symbol" json:"native_currency_symbol"`
	NativeCurrencyName     string         `db:"native_currency_name" json:"native_currency_name"`
	NativeCurrencyDecimals int            `db:"native_currency_decimals" json:"native_currency_decimals"`
	IsTestnet              bool           `db:"is_testnet" json:"is_testnet"`
	IsActive               bool           `db:"is_active" json:"is_active"`
	DisplayColor           string         `db:"display_color" json:"display_color"`
	IconURL                sql.NullString `db:"icon_url" json:"icon_url,omitempty"`
	SortOrder              int            `db:"sort_order" json:"sort_order"`
	CreatedAt              time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt              time.Time      `db:"updated_at" json:"updated_at"`
}

func (n *Network) RPCURLFallbackValue() *string {
	if n.RPCURLFallback.Valid {
		return &n.RPCURLFallback.String
	}
	return nil
}

func (n *Network) IconURLValue() *string {
	if n.IconURL.Valid {
		return &n.IconURL.String
	}
	return nil
}

func (n *Network) ChainIDValue() *int64 {
	if n.ChainID.Valid {
		return &n.ChainID.Int64
	}
	return nil
}

// NetworkResponse is the JSON response for network data
type NetworkResponse struct {
	ID                     int64     `json:"id"`
	Slug                   string    `json:"slug"`
	ChainType              ChainType `json:"chain_type"`
	Name                   string    `json:"name"`
	ChainID                *int64    `json:"chain_id,omitempty"`
	RPCURL                 string    `json:"rpc_url"`
	RPCURLFallback         *string   `json:"rpc_url_fallback,omitempty"`
	ExplorerURL            string    `json:"explorer_url"`
	NativeCurrencySymbol   string    `json:"native_currency_symbol"`
	NativeCurrencyName     string    `json:"native_currency_name"`
	NativeCurrencyDecimals int       `json:"native_currency_decimals"`
	IsTestnet              bool      `json:"is_testnet"`
	DisplayColor           string    `json:"display_color"`
	IconURL                *string   `json:"icon_url,omitempty"`
}

func (n *Network) ToResponse() NetworkResponse {
	return NetworkResponse{
		ID:                     n.ID,
		Slug:                   n.Slug,
		ChainType:              n.ChainType,
		Name:                   n.Name,
		ChainID:                n.ChainIDValue(),
		RPCURL:                 n.RPCURL,
		RPCURLFallback:         n.RPCURLFallbackValue(),
		ExplorerURL:            n.ExplorerURL,
		NativeCurrencySymbol:   n.NativeCurrencySymbol,
		NativeCurrencyName:     n.NativeCurrencyName,
		NativeCurrencyDecimals: n.NativeCurrencyDecimals,
		IsTestnet:              n.IsTestnet,
		DisplayColor:           n.DisplayColor,
		IconURL:                n.IconURLValue(),
	}
}
