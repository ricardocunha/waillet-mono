package models

import (
	"database/sql"
	"time"
)

type PolicyType string

const (
	PolicyTypeAllowlist     PolicyType = "allowlist"
	PolicyTypeSpendingLimit PolicyType = "spending_limit"
	PolicyTypeContractBlock PolicyType = "contract_block"
)

type Policy struct {
	ID            int64           `db:"id" json:"id"`
	WalletAddress string          `db:"wallet_address" json:"wallet_address"`
	PolicyType    PolicyType      `db:"policy_type" json:"policy_type"`
	TargetAddress sql.NullString  `db:"target_address" json:"target_address,omitempty"`
	Chain         string          `db:"chain" json:"chain"`
	LimitAmount   sql.NullFloat64 `db:"limit_amount" json:"limit_amount,omitempty"`
	IsActive      bool            `db:"is_active" json:"is_active"`
	CreatedAt     time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time       `db:"updated_at" json:"updated_at"`
}

func (p *Policy) TargetAddressValue() *string {
	if p.TargetAddress.Valid {
		return &p.TargetAddress.String
	}
	return nil
}

func (p *Policy) LimitAmountValue() *float64 {
	if p.LimitAmount.Valid {
		return &p.LimitAmount.Float64
	}
	return nil
}
