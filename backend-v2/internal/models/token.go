package models

import (
	"database/sql"
	"time"
)

type Token struct {
	ID                int64           `db:"id" json:"id"`
	CMCID             int             `db:"cmc_id" json:"cmc_id"`
	Symbol            string          `db:"symbol" json:"symbol"`
	Name              string          `db:"name" json:"name"`
	Slug              string          `db:"slug" json:"slug"`
	CMCRank           sql.NullInt64   `db:"cmc_rank" json:"cmc_rank,omitempty"`
	PriceUSD          sql.NullFloat64 `db:"price_usd" json:"price_usd,omitempty"`
	MarketCapUSD      sql.NullFloat64 `db:"market_cap_usd" json:"market_cap_usd,omitempty"`
	Volume24hUSD      sql.NullFloat64 `db:"volume_24h_usd" json:"volume_24h_usd,omitempty"`
	PercentChange24h  sql.NullFloat64 `db:"percent_change_24h" json:"percent_change_24h,omitempty"`
	PercentChange7d   sql.NullFloat64 `db:"percent_change_7d" json:"percent_change_7d,omitempty"`
	CirculatingSupply sql.NullFloat64 `db:"circulating_supply" json:"circulating_supply,omitempty"`
	TotalSupply       sql.NullFloat64 `db:"total_supply" json:"total_supply,omitempty"`
	LogoURL           sql.NullString  `db:"logo_url" json:"logo_url,omitempty"`
	IsActive          bool            `db:"is_active" json:"is_active"`
	LastPriceUpdate   sql.NullTime    `db:"last_price_update" json:"last_price_update,omitempty"`
	CreatedAt         time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time       `db:"updated_at" json:"updated_at"`
}

type TokenAddress struct {
	ID              int64     `db:"id" json:"id"`
	TokenID         int64     `db:"token_id" json:"token_id"`
	NetworkID       int64     `db:"network_id" json:"network_id"`
	ContractAddress string    `db:"contract_address" json:"contract_address"`
	Decimals        int       `db:"decimals" json:"decimals"`
	IsNative        bool      `db:"is_native" json:"is_native"`
	IsVerified      bool      `db:"is_verified" json:"is_verified"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

// TokenAddressDTO is a simplified view of token address for API responses
type TokenAddressDTO struct {
	ContractAddress string `json:"contract_address"`
	Decimals        int    `json:"decimals"`
	IsNative        bool   `json:"is_native"`
}

// TokenWithAddresses combines token info with network addresses
type TokenWithAddresses struct {
	Token     TokenResponse              `json:"token"`
	Addresses map[string]TokenAddressDTO `json:"addresses"` // key: network slug
}

// TokenResponse is the JSON response for token data
type TokenResponse struct {
	ID               int64    `json:"id"`
	CMCID            int      `json:"cmc_id"`
	Symbol           string   `json:"symbol"`
	Name             string   `json:"name"`
	Slug             string   `json:"slug"`
	CMCRank          *int64   `json:"cmc_rank,omitempty"`
	PriceUSD         *float64 `json:"price_usd,omitempty"`
	MarketCapUSD     *float64 `json:"market_cap_usd,omitempty"`
	Volume24hUSD     *float64 `json:"volume_24h_usd,omitempty"`
	PercentChange24h *float64 `json:"percent_change_24h,omitempty"`
	PercentChange7d  *float64 `json:"percent_change_7d,omitempty"`
	LogoURL          *string  `json:"logo_url,omitempty"`
}

func (t *Token) ToResponse() TokenResponse {
	resp := TokenResponse{
		ID:     t.ID,
		CMCID:  t.CMCID,
		Symbol: t.Symbol,
		Name:   t.Name,
		Slug:   t.Slug,
	}

	if t.CMCRank.Valid {
		resp.CMCRank = &t.CMCRank.Int64
	}
	if t.PriceUSD.Valid {
		resp.PriceUSD = &t.PriceUSD.Float64
	}
	if t.MarketCapUSD.Valid {
		resp.MarketCapUSD = &t.MarketCapUSD.Float64
	}
	if t.Volume24hUSD.Valid {
		resp.Volume24hUSD = &t.Volume24hUSD.Float64
	}
	if t.PercentChange24h.Valid {
		resp.PercentChange24h = &t.PercentChange24h.Float64
	}
	if t.PercentChange7d.Valid {
		resp.PercentChange7d = &t.PercentChange7d.Float64
	}
	if t.LogoURL.Valid {
		resp.LogoURL = &t.LogoURL.String
	}

	return resp
}

// TokenWithNetworkSlug is used for queries that join tokens with network info
type TokenWithNetworkSlug struct {
	Token
	NetworkSlug     string `db:"network_slug"`
	ContractAddress string `db:"contract_address"`
	Decimals        int    `db:"decimals"`
	IsNative        bool   `db:"is_native"`
}
