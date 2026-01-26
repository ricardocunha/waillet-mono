package models

import (
	"database/sql"
	"time"
)

type Decision string

const (
	DecisionApproved Decision = "approved"
	DecisionBlocked  Decision = "blocked"
	DecisionPending  Decision = "pending"
)

type RiskLog struct {
	ID            int64          `db:"id" json:"id"`
	WalletAddress string         `db:"wallet_address" json:"wallet_address"`
	TxHash        sql.NullString `db:"tx_hash" json:"tx_hash,omitempty"`
	Method        string         `db:"method" json:"method"`
	Params        sql.NullString `db:"params" json:"params,omitempty"`
	RiskScore     int            `db:"risk_score" json:"risk_score"`
	AISummary     sql.NullString `db:"ai_summary" json:"ai_summary,omitempty"`
	Decision      Decision       `db:"decision" json:"decision"`
	CreatedAt     time.Time      `db:"created_at" json:"created_at"`
}

type RiskLevel string

const (
	RiskLevelLow    RiskLevel = "LOW"
	RiskLevelMedium RiskLevel = "MEDIUM"
	RiskLevelHigh   RiskLevel = "HIGH"
)

func GetRiskLevel(score int) RiskLevel {
	if score <= 30 {
		return RiskLevelLow
	}
	if score <= 70 {
		return RiskLevelMedium
	}
	return RiskLevelHigh
}
