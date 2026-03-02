package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/waillet-app/backend-v2/internal/models"
)

type DocumentShareRepository interface {
	Create(ctx context.Context, share *models.DocumentShare) error
	GetByID(ctx context.Context, id int64) (*models.DocumentShare, error)
	GetByDocumentID(ctx context.Context, documentID int64) ([]models.DocumentShare, error)
	GetByRecipientAddress(ctx context.Context, recipientAddress string) ([]models.DocumentShare, error)
	GetByTokenID(ctx context.Context, tokenID int64) (*models.DocumentShare, error)
	UpdateStatus(ctx context.Context, id int64, status models.ShareStatus) error
	UpdateTokenInfo(ctx context.Context, id int64, tokenID int64, txHash string) error
	UpdateRevokeTxHash(ctx context.Context, id int64, txHash string) error
	GetActiveShareForRecipient(ctx context.Context, documentID int64, recipientAddress string) (*models.DocumentShare, error)
	ExpireOldShares(ctx context.Context) (int64, error)
}

type documentShareRepository struct {
	db *sqlx.DB
}

func NewDocumentShareRepository(db *sqlx.DB) DocumentShareRepository {
	return &documentShareRepository{db: db}
}

func (r *documentShareRepository) Create(ctx context.Context, share *models.DocumentShare) error {
	query := `INSERT INTO document_shares (document_id, document_hash, owner_address, recipient_address, expires_at, status)
		VALUES (?, ?, ?, ?, ?, ?)`

	result, err := r.db.ExecContext(ctx, query,
		share.DocumentID,
		share.DocumentHash,
		share.OwnerAddress,
		share.RecipientAddress,
		share.ExpiresAt,
		share.Status,
	)
	if err != nil {
		return fmt.Errorf("failed to create document share: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	share.ID = id

	return nil
}

func (r *documentShareRepository) GetByID(ctx context.Context, id int64) (*models.DocumentShare, error) {
	var share models.DocumentShare
	query := `SELECT id, document_id, document_hash, owner_address, recipient_address,
		token_id, tx_hash, expires_at, status, revoke_tx_hash, created_at, updated_at
		FROM document_shares WHERE id = ?`

	err := r.db.GetContext(ctx, &share, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get document share: %w", err)
	}

	return &share, nil
}

func (r *documentShareRepository) GetByDocumentID(ctx context.Context, documentID int64) ([]models.DocumentShare, error) {
	var shares []models.DocumentShare
	query := `SELECT id, document_id, document_hash, owner_address, recipient_address,
		token_id, tx_hash, expires_at, status, revoke_tx_hash, created_at, updated_at
		FROM document_shares WHERE document_id = ? ORDER BY created_at DESC`

	err := r.db.SelectContext(ctx, &shares, query, documentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get shares by document: %w", err)
	}

	return shares, nil
}

func (r *documentShareRepository) GetByRecipientAddress(ctx context.Context, recipientAddress string) ([]models.DocumentShare, error) {
	var shares []models.DocumentShare
	query := `SELECT ds.id, ds.document_id, ds.document_hash, ds.owner_address, ds.recipient_address,
		ds.token_id, ds.tx_hash, ds.expires_at, ds.status, ds.revoke_tx_hash, ds.created_at, ds.updated_at
		FROM document_shares ds
		WHERE LOWER(ds.recipient_address) = LOWER(?)
		AND ds.status = 'active'
		AND ds.expires_at > NOW()
		ORDER BY ds.created_at DESC`

	err := r.db.SelectContext(ctx, &shares, query, recipientAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get shares by recipient: %w", err)
	}

	return shares, nil
}

func (r *documentShareRepository) GetByTokenID(ctx context.Context, tokenID int64) (*models.DocumentShare, error) {
	var share models.DocumentShare
	query := `SELECT id, document_id, document_hash, owner_address, recipient_address,
		token_id, tx_hash, expires_at, status, revoke_tx_hash, created_at, updated_at
		FROM document_shares WHERE token_id = ?`

	err := r.db.GetContext(ctx, &share, query, tokenID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get share by token ID: %w", err)
	}

	return &share, nil
}

func (r *documentShareRepository) UpdateStatus(ctx context.Context, id int64, status models.ShareStatus) error {
	query := `UPDATE document_shares SET status = ? WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update share status: %w", err)
	}

	return nil
}

func (r *documentShareRepository) UpdateTokenInfo(ctx context.Context, id int64, tokenID int64, txHash string) error {
	query := `UPDATE document_shares SET token_id = ?, tx_hash = ?, status = 'active' WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query, tokenID, txHash, id)
	if err != nil {
		return fmt.Errorf("failed to update token info: %w", err)
	}

	return nil
}

func (r *documentShareRepository) UpdateRevokeTxHash(ctx context.Context, id int64, txHash string) error {
	query := `UPDATE document_shares SET revoke_tx_hash = ? WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query, txHash, id)
	if err != nil {
		return fmt.Errorf("failed to update revoke tx hash: %w", err)
	}

	return nil
}

func (r *documentShareRepository) GetActiveShareForRecipient(ctx context.Context, documentID int64, recipientAddress string) (*models.DocumentShare, error) {
	var share models.DocumentShare
	query := `SELECT id, document_id, document_hash, owner_address, recipient_address,
		token_id, tx_hash, expires_at, status, revoke_tx_hash, created_at, updated_at
		FROM document_shares
		WHERE document_id = ? AND LOWER(recipient_address) = LOWER(?) AND status = 'active' AND expires_at > NOW()
		LIMIT 1`

	err := r.db.GetContext(ctx, &share, query, documentID, recipientAddress)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get active share: %w", err)
	}

	return &share, nil
}

func (r *documentShareRepository) ExpireOldShares(ctx context.Context) (int64, error) {
	query := `UPDATE document_shares SET status = 'expired' WHERE status = 'active' AND expires_at <= NOW()`

	result, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed to expire old shares: %w", err)
	}

	affected, _ := result.RowsAffected()
	return affected, nil
}
