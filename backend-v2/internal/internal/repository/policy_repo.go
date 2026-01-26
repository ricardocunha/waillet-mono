package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/waillet/backend-v2/internal/models"
)

type PolicyRepository interface {
	GetByWalletAddress(ctx context.Context, walletAddress string) ([]models.Policy, error)
	GetByID(ctx context.Context, id int64) (*models.Policy, error)
	GetActiveByWalletAndType(ctx context.Context, walletAddress string, policyType models.PolicyType) ([]models.Policy, error)
	Create(ctx context.Context, policy *models.Policy) error
	Deactivate(ctx context.Context, id int64) error
	Delete(ctx context.Context, id int64) error
}

type policyRepository struct {
	db *sqlx.DB
}

func NewPolicyRepository(db *sqlx.DB) PolicyRepository {
	return &policyRepository{db: db}
}

func (r *policyRepository) GetByWalletAddress(ctx context.Context, walletAddress string) ([]models.Policy, error) {
	var policies []models.Policy
	query := `SELECT id, wallet_address, policy_type, target_address, chain, limit_amount, is_active, created_at, updated_at
		FROM policies WHERE wallet_address = ? AND is_active = TRUE ORDER BY created_at DESC`

	err := r.db.SelectContext(ctx, &policies, query, walletAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get policies: %w", err)
	}

	return policies, nil
}

func (r *policyRepository) GetByID(ctx context.Context, id int64) (*models.Policy, error) {
	var policy models.Policy
	query := `SELECT id, wallet_address, policy_type, target_address, chain, limit_amount, is_active, created_at, updated_at
		FROM policies WHERE id = ?`

	err := r.db.GetContext(ctx, &policy, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get policy: %w", err)
	}

	return &policy, nil
}

func (r *policyRepository) GetActiveByWalletAndType(ctx context.Context, walletAddress string, policyType models.PolicyType) ([]models.Policy, error) {
	var policies []models.Policy
	query := `SELECT id, wallet_address, policy_type, target_address, chain, limit_amount, is_active, created_at, updated_at
		FROM policies WHERE wallet_address = ? AND policy_type = ? AND is_active = TRUE`

	err := r.db.SelectContext(ctx, &policies, query, walletAddress, policyType)
	if err != nil {
		return nil, fmt.Errorf("failed to get policies by type: %w", err)
	}

	return policies, nil
}

func (r *policyRepository) Create(ctx context.Context, policy *models.Policy) error {
	query := `INSERT INTO policies (wallet_address, policy_type, target_address, chain, limit_amount)
		VALUES (?, ?, ?, ?, ?)`

	result, err := r.db.ExecContext(ctx, query,
		policy.WalletAddress,
		policy.PolicyType,
		policy.TargetAddress,
		policy.Chain,
		policy.LimitAmount,
	)
	if err != nil {
		return fmt.Errorf("failed to create policy: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	policy.ID = id
	policy.IsActive = true

	return nil
}

func (r *policyRepository) Deactivate(ctx context.Context, id int64) error {
	query := `UPDATE policies SET is_active = FALSE WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to deactivate policy: %w", err)
	}

	return nil
}

func (r *policyRepository) Delete(ctx context.Context, id int64) error {
	return r.Deactivate(ctx, id)
}
