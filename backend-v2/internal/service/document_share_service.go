package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
)

type DocumentShareService struct {
	shareRepo repository.DocumentShareRepository
	docRepo   repository.SmartDocumentRepository
	docSvc    *DocumentService
}

func NewDocumentShareService(
	shareRepo repository.DocumentShareRepository,
	docRepo repository.SmartDocumentRepository,
	docSvc *DocumentService,
) *DocumentShareService {
	return &DocumentShareService{
		shareRepo: shareRepo,
		docRepo:   docRepo,
		docSvc:    docSvc,
	}
}

// InitiateShare creates a pending share record and returns the document hash for on-chain registration
func (s *DocumentShareService) InitiateShare(ctx context.Context, ownerAddress string, docID int64, recipientAddress string, expiresAt time.Time) (*models.DocumentShare, string, error) {
	// Verify document ownership
	doc, err := s.docRepo.GetByID(ctx, docID)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get document: %w", err)
	}
	if doc == nil {
		return nil, "", fmt.Errorf("document not found")
	}
	if !strings.EqualFold(doc.WalletAddress, ownerAddress) {
		return nil, "", fmt.Errorf("not authorized to share this document")
	}

	// Validate recipient
	if strings.EqualFold(ownerAddress, recipientAddress) {
		return nil, "", fmt.Errorf("cannot share document with yourself")
	}

	// Check expiration
	if expiresAt.Before(time.Now()) {
		return nil, "", fmt.Errorf("expiration must be in the future")
	}

	// Generate document hash (same format as frontend keccak256)
	// Using a deterministic identifier: "doc:{id}:{s3_key}"
	docIdentifier := fmt.Sprintf("doc:%d:%s", doc.ID, doc.S3Key)

	share := &models.DocumentShare{
		DocumentID:       docID,
		DocumentHash:     docIdentifier,
		OwnerAddress:     ownerAddress,
		RecipientAddress: recipientAddress,
		ExpiresAt:        expiresAt,
		Status:           models.ShareStatusPending,
	}

	if err := s.shareRepo.Create(ctx, share); err != nil {
		return nil, "", fmt.Errorf("failed to create share: %w", err)
	}

	log.Info().
		Int64("share_id", share.ID).
		Int64("document_id", docID).
		Str("recipient", recipientAddress).
		Msg("Document share initiated")

	return share, docIdentifier, nil
}

// ConfirmShare updates a pending share with the on-chain token info
func (s *DocumentShareService) ConfirmShare(ctx context.Context, shareID int64, tokenID int64, txHash string) error {
	share, err := s.shareRepo.GetByID(ctx, shareID)
	if err != nil {
		return fmt.Errorf("failed to get share: %w", err)
	}
	if share == nil {
		return fmt.Errorf("share not found")
	}
	if share.Status != models.ShareStatusPending {
		return fmt.Errorf("share is not in pending status")
	}

	if err := s.shareRepo.UpdateTokenInfo(ctx, shareID, tokenID, txHash); err != nil {
		return fmt.Errorf("failed to confirm share: %w", err)
	}

	log.Info().
		Int64("share_id", shareID).
		Int64("token_id", tokenID).
		Str("tx_hash", txHash).
		Msg("Document share confirmed")

	return nil
}

// GetDocumentShares returns all shares for a document (owner only)
func (s *DocumentShareService) GetDocumentShares(ctx context.Context, docID int64, ownerAddress string) ([]models.DocumentShare, error) {
	// Verify ownership
	doc, err := s.docRepo.GetByID(ctx, docID)
	if err != nil {
		return nil, fmt.Errorf("failed to get document: %w", err)
	}
	if doc == nil {
		return nil, fmt.Errorf("document not found")
	}
	if !strings.EqualFold(doc.WalletAddress, ownerAddress) {
		return nil, fmt.Errorf("not authorized")
	}

	return s.shareRepo.GetByDocumentID(ctx, docID)
}

// SharedDocumentView combines share info with document info for recipients
type SharedDocumentView struct {
	Share    models.DocumentShare `json:"share"`
	Document models.SmartDocument `json:"document"`
}

// GetSharedWithMe returns all active shares for a recipient with document details
func (s *DocumentShareService) GetSharedWithMe(ctx context.Context, recipientAddress string) ([]SharedDocumentView, error) {
	shares, err := s.shareRepo.GetByRecipientAddress(ctx, recipientAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get shared documents: %w", err)
	}

	var views []SharedDocumentView
	for _, share := range shares {
		doc, err := s.docRepo.GetByID(ctx, share.DocumentID)
		if err != nil || doc == nil {
			continue
		}
		views = append(views, SharedDocumentView{
			Share:    share,
			Document: *doc,
		})
	}

	return views, nil
}

// GetSharedDocumentURL validates access and returns a presigned URL for a shared document
func (s *DocumentShareService) GetSharedDocumentURL(ctx context.Context, shareID int64, viewerAddress string) (string, error) {
	share, err := s.shareRepo.GetByID(ctx, shareID)
	if err != nil {
		return "", fmt.Errorf("failed to get share: %w", err)
	}
	if share == nil {
		return "", fmt.Errorf("share not found")
	}

	// Validate viewer is the recipient
	if !strings.EqualFold(share.RecipientAddress, viewerAddress) {
		return "", fmt.Errorf("not authorized to view this document")
	}

	// Validate share is active and not expired
	if share.Status != models.ShareStatusActive {
		return "", fmt.Errorf("share is not active")
	}
	if time.Now().After(share.ExpiresAt) {
		// Auto-expire
		_ = s.shareRepo.UpdateStatus(ctx, shareID, models.ShareStatusExpired)
		return "", fmt.Errorf("share has expired")
	}

	// Get presigned URL using the document service
	doc, err := s.docRepo.GetByID(ctx, share.DocumentID)
	if err != nil || doc == nil {
		return "", fmt.Errorf("document not found")
	}

	url, err := s.docSvc.GeneratePresignedURLForKey(ctx, doc.S3Key)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return url, nil
}

// RevokeShare marks a share as revoked (owner only)
func (s *DocumentShareService) RevokeShare(ctx context.Context, shareID int64, ownerAddress string) error {
	share, err := s.shareRepo.GetByID(ctx, shareID)
	if err != nil {
		return fmt.Errorf("failed to get share: %w", err)
	}
	if share == nil {
		return fmt.Errorf("share not found")
	}
	if !strings.EqualFold(share.OwnerAddress, ownerAddress) {
		return fmt.Errorf("not authorized to revoke this share")
	}
	if share.Status != models.ShareStatusActive {
		return fmt.Errorf("share is not active")
	}

	if err := s.shareRepo.UpdateStatus(ctx, shareID, models.ShareStatusRevoked); err != nil {
		return fmt.Errorf("failed to revoke share: %w", err)
	}

	log.Info().
		Int64("share_id", shareID).
		Msg("Document share revoked")

	return nil
}

// ConfirmRevoke stores the on-chain revoke transaction hash
func (s *DocumentShareService) ConfirmRevoke(ctx context.Context, shareID int64, txHash string) error {
	share, err := s.shareRepo.GetByID(ctx, shareID)
	if err != nil {
		return fmt.Errorf("failed to get share: %w", err)
	}
	if share == nil {
		return fmt.Errorf("share not found")
	}

	if err := s.shareRepo.UpdateRevokeTxHash(ctx, shareID, txHash); err != nil {
		return fmt.Errorf("failed to store revoke tx hash: %w", err)
	}

	return nil
}
