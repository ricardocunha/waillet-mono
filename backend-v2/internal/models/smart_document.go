package models

import (
	"database/sql"
	"time"
)

type OCRStatus string

const (
	OCRStatusPending    OCRStatus = "pending"
	OCRStatusProcessing OCRStatus = "processing"
	OCRStatusCompleted  OCRStatus = "completed"
	OCRStatusFailed     OCRStatus = "failed"
)

type SmartDocument struct {
	ID            int64          `db:"id" json:"id"`
	WalletAddress string         `db:"wallet_address" json:"wallet_address"`
	Title         string         `db:"title" json:"title"`
	FileName      string         `db:"file_name" json:"file_name"`
	FileType      string         `db:"file_type" json:"file_type"`
	FileSize      int            `db:"file_size" json:"file_size"`
	S3Key         string         `db:"s3_key" json:"s3_key"`
	S3URL         string         `db:"s3_url" json:"s3_url"`
	DocumentType  sql.NullString `db:"document_type" json:"document_type,omitempty"`
	OCRStatus     OCRStatus      `db:"ocr_status" json:"ocr_status"`
	OCRRawText    sql.NullString `db:"ocr_raw_text" json:"ocr_raw_text,omitempty"`
	MetadataJSON  sql.NullString `db:"metadata_json" json:"metadata_json,omitempty"`
	OCRError      sql.NullString `db:"ocr_error" json:"ocr_error,omitempty"`
	CreatedAt     time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time      `db:"updated_at" json:"updated_at"`
}

type DocumentMetadata struct {
	DocumentType string            `json:"document_type"`
	Title        string            `json:"title"`
	Summary      string            `json:"summary"`
	Dates        []DateField       `json:"dates"`
	Parties      []Party           `json:"parties"`
	Amounts      []Amount          `json:"amounts"`
	KeyFields    map[string]string `json:"key_fields"`
	Language     string            `json:"language"`
	Confidence   int               `json:"confidence"`
}

type DateField struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type Party struct {
	Role string `json:"role"`
	Name string `json:"name"`
}

type Amount struct {
	Label    string `json:"label"`
	Value    string `json:"value"`
	Currency string `json:"currency"`
}
