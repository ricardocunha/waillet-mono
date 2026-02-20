package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/waillet-app/backend-v2/internal/models"
)

type SmartDocumentRepository interface {
	Create(ctx context.Context, doc *models.SmartDocument) error
	GetByID(ctx context.Context, id int64) (*models.SmartDocument, error)
	GetByWalletAddress(ctx context.Context, walletAddress string) ([]models.SmartDocument, error)
	UpdateOCRResult(ctx context.Context, id int64, status models.OCRStatus, rawText, metadataJSON, ocrError, documentType string) error
	UpdateTitle(ctx context.Context, id int64, title string) error
	UpdateFileInfo(ctx context.Context, id int64, title, fileName, s3Key, s3URL string, thumbnailKey string) error
	UpdateThumbnailKey(ctx context.Context, id int64, thumbnailKey string) error
	Delete(ctx context.Context, id int64) error
}

type smartDocumentRepository struct {
	db *sqlx.DB
}

func NewSmartDocumentRepository(db *sqlx.DB) SmartDocumentRepository {
	return &smartDocumentRepository{db: db}
}

func (r *smartDocumentRepository) Create(ctx context.Context, doc *models.SmartDocument) error {
	query := `INSERT INTO smart_documents (wallet_address, title, file_name, file_type, file_size, s3_key, s3_url, ocr_status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := r.db.ExecContext(ctx, query,
		doc.WalletAddress,
		doc.Title,
		doc.FileName,
		doc.FileType,
		doc.FileSize,
		doc.S3Key,
		doc.S3URL,
		doc.OCRStatus,
	)
	if err != nil {
		return fmt.Errorf("failed to create smart document: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	doc.ID = id

	return nil
}

func (r *smartDocumentRepository) GetByID(ctx context.Context, id int64) (*models.SmartDocument, error) {
	var doc models.SmartDocument
	query := `SELECT id, wallet_address, title, file_name, file_type, file_size, s3_key, s3_url,
		document_type, ocr_status, ocr_raw_text, metadata_json, ocr_error, thumbnail_key, created_at, updated_at
		FROM smart_documents WHERE id = ?`

	err := r.db.GetContext(ctx, &doc, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get smart document: %w", err)
	}

	return &doc, nil
}

func (r *smartDocumentRepository) GetByWalletAddress(ctx context.Context, walletAddress string) ([]models.SmartDocument, error) {
	var docs []models.SmartDocument
	query := `SELECT id, wallet_address, title, file_name, file_type, file_size, s3_key, s3_url,
		document_type, ocr_status, ocr_raw_text, metadata_json, ocr_error, thumbnail_key, created_at, updated_at
		FROM smart_documents WHERE LOWER(wallet_address) = LOWER(?) ORDER BY created_at DESC`

	err := r.db.SelectContext(ctx, &docs, query, walletAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get smart documents: %w", err)
	}

	return docs, nil
}

func (r *smartDocumentRepository) UpdateOCRResult(ctx context.Context, id int64, status models.OCRStatus, rawText, metadataJSON, ocrError, documentType string) error {
	query := `UPDATE smart_documents SET ocr_status = ?, ocr_raw_text = ?, metadata_json = ?, ocr_error = ?, document_type = ?
		WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query,
		status,
		sql.NullString{String: rawText, Valid: rawText != ""},
		sql.NullString{String: metadataJSON, Valid: metadataJSON != ""},
		sql.NullString{String: ocrError, Valid: ocrError != ""},
		sql.NullString{String: documentType, Valid: documentType != ""},
		id,
	)
	if err != nil {
		return fmt.Errorf("failed to update OCR result: %w", err)
	}

	return nil
}

func (r *smartDocumentRepository) UpdateTitle(ctx context.Context, id int64, title string) error {
	query := `UPDATE smart_documents SET title = ? WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query, title, id)
	if err != nil {
		return fmt.Errorf("failed to update document title: %w", err)
	}

	return nil
}

func (r *smartDocumentRepository) UpdateFileInfo(ctx context.Context, id int64, title, fileName, s3Key, s3URL string, thumbnailKey string) error {
	query := `UPDATE smart_documents SET title = ?, file_name = ?, s3_key = ?, s3_url = ?, thumbnail_key = ? WHERE id = ?`

	var thumbParam interface{} = thumbnailKey
	if thumbnailKey == "" {
		thumbParam = nil
	}

	_, err := r.db.ExecContext(ctx, query, title, fileName, s3Key, s3URL, thumbParam, id)
	if err != nil {
		return fmt.Errorf("failed to update document file info: %w", err)
	}

	return nil
}

func (r *smartDocumentRepository) UpdateThumbnailKey(ctx context.Context, id int64, thumbnailKey string) error {
	query := `UPDATE smart_documents SET thumbnail_key = ? WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query, thumbnailKey, id)
	if err != nil {
		return fmt.Errorf("failed to update thumbnail key: %w", err)
	}

	return nil
}

func (r *smartDocumentRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM smart_documents WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete smart document: %w", err)
	}

	return nil
}
