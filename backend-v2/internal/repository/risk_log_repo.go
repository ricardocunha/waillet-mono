package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/waillet/backend-v2/internal/models"
)

type RiskLogRepository interface {
	GetByID(ctx context.Context, id int64) (*models.RiskLog, error)
	GetByWalletAddress(ctx context.Context, walletAddress string, limit int) ([]models.RiskLog, error)
	HasPreviousInteraction(ctx context.Context, walletAddress, toAddress string) (bool, error)
	Create(ctx context.Context, log *models.RiskLog) error
	UpdateDecision(ctx context.Context, id int64, decision models.Decision, txHash string) error
}

type riskLogRepository struct {
	db *sqlx.DB
}

func NewRiskLogRepository(db *sqlx.DB) RiskLogRepository {
	return &riskLogRepository{db: db}
}

func (r *riskLogRepository) GetByID(ctx context.Context, id int64) (*models.RiskLog, error) {
	var log models.RiskLog
	query := `SELECT id, wallet_address, tx_hash, method, params, risk_score, ai_summary, decision, created_at
		FROM risk_logs WHERE id = ?`

	err := r.db.GetContext(ctx, &log, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get risk log: %w", err)
	}

	return &log, nil
}

func (r *riskLogRepository) GetByWalletAddress(ctx context.Context, walletAddress string, limit int) ([]models.RiskLog, error) {
	var logs []models.RiskLog
	query := `SELECT id, wallet_address, tx_hash, method, params, risk_score, ai_summary, decision, created_at
		FROM risk_logs WHERE wallet_address = ? ORDER BY created_at DESC LIMIT ?`

	err := r.db.SelectContext(ctx, &logs, query, walletAddress, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get risk logs: %w", err)
	}

	return logs, nil
}

func (r *riskLogRepository) HasPreviousInteraction(ctx context.Context, walletAddress, toAddress string) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM risk_logs
		WHERE wallet_address = ? AND params LIKE ? AND decision = 'approved'`

	err := r.db.GetContext(ctx, &count, query, walletAddress, "%"+toAddress+"%")
	if err != nil {
		return false, fmt.Errorf("failed to check previous interaction: %w", err)
	}

	return count > 0, nil
}

func (r *riskLogRepository) Create(ctx context.Context, log *models.RiskLog) error {
	query := `INSERT INTO risk_logs (wallet_address, method, params, risk_score, ai_summary, decision)
		VALUES (?, ?, ?, ?, ?, ?)`

	result, err := r.db.ExecContext(ctx, query,
		log.WalletAddress,
		log.Method,
		log.Params,
		log.RiskScore,
		log.AISummary,
		log.Decision,
	)
	if err != nil {
		return fmt.Errorf("failed to create risk log: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	log.ID = id

	return nil
}

func (r *riskLogRepository) UpdateDecision(ctx context.Context, id int64, decision models.Decision, txHash string) error {
	var query string
	var args []interface{}

	if txHash != "" {
		query = `UPDATE risk_logs SET decision = ?, tx_hash = ? WHERE id = ?`
		args = []interface{}{decision, txHash, id}
	} else {
		query = `UPDATE risk_logs SET decision = ? WHERE id = ?`
		args = []interface{}{decision, id}
	}

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update decision: %w", err)
	}

	return nil
}
