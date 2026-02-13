package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/sashabaranov/go-openai"
	"github.com/waillet-app/backend-v2/internal/config"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/repository"
)

type DocumentService struct {
	s3Client *s3.Client
	s3Bucket string
	s3Region string
	aiClient *openai.Client
	docRepo  repository.SmartDocumentRepository
}

func NewDocumentService(s3Cfg *config.S3Config, openAICfg *config.OpenAIConfig, docRepo repository.SmartDocumentRepository) *DocumentService {
	svc := &DocumentService{
		s3Bucket: s3Cfg.Bucket,
		s3Region: s3Cfg.Region,
		docRepo:  docRepo,
	}

	// Init S3 client
	if s3Cfg.AccessKey != "" {
		customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
			if s3Cfg.Endpoint != "" {
				return aws.Endpoint{
					URL:               s3Cfg.Endpoint,
					HostnameImmutable: true,
				}, nil
			}
			return aws.Endpoint{}, &aws.EndpointNotFoundError{}
		})

		cfg, err := awsconfig.LoadDefaultConfig(context.Background(),
			awsconfig.WithRegion(s3Cfg.Region),
			awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
				s3Cfg.AccessKey, s3Cfg.SecretKey, "",
			)),
			awsconfig.WithEndpointResolverWithOptions(customResolver),
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to load AWS config")
		} else {
			svc.s3Client = s3.NewFromConfig(cfg, func(o *s3.Options) {
				if s3Cfg.Endpoint != "" {
					o.UsePathStyle = true
				}
			})
			log.Info().Str("bucket", s3Cfg.Bucket).Str("region", s3Cfg.Region).Msg("S3 client initialized")
		}
	} else {
		log.Warn().Msg("AWS credentials not set - document upload will be unavailable")
	}

	// Init OpenAI client
	if openAICfg.APIKey != "" {
		svc.aiClient = openai.NewClient(openAICfg.APIKey)
	} else {
		log.Warn().Msg("OpenAI API key not set - OCR will be unavailable")
	}

	return svc
}

func (s *DocumentService) UploadAndProcess(ctx context.Context, walletAddress, fileName, fileType string, fileData []byte) (*models.SmartDocument, error) {
	if s.s3Client == nil {
		return nil, fmt.Errorf("S3 client not configured")
	}

	// Generate S3 key
	docUUID := uuid.New().String()
	s3Key := fmt.Sprintf("documents/%s/%s/%s", strings.ToLower(walletAddress), docUUID, fileName)

	// Upload to S3
	contentType := fileType
	_, err := s.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.s3Bucket),
		Key:         aws.String(s3Key),
		Body:        bytes.NewReader(fileData),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upload to S3: %w", err)
	}

	s3URL := fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.s3Bucket, s.s3Region, s3Key)

	// Create DB record
	doc := &models.SmartDocument{
		WalletAddress: walletAddress,
		Title:         fileName,
		FileName:      fileName,
		FileType:      fileType,
		FileSize:      len(fileData),
		S3Key:         s3Key,
		S3URL:         s3URL,
		OCRStatus:     models.OCRStatusPending,
	}

	if err := s.docRepo.Create(ctx, doc); err != nil {
		return nil, fmt.Errorf("failed to create document record: %w", err)
	}

	log.Info().Int64("id", doc.ID).Str("s3_key", s3Key).Msg("Document uploaded to S3")

	// Process OCR synchronously
	s.processOCR(ctx, doc, fileData, fileType)

	// Re-fetch to get updated fields
	updated, err := s.docRepo.GetByID(ctx, doc.ID)
	if err != nil || updated == nil {
		return doc, nil
	}

	return updated, nil
}

func (s *DocumentService) processOCR(ctx context.Context, doc *models.SmartDocument, fileData []byte, fileType string) {
	if s.aiClient == nil {
		_ = s.docRepo.UpdateOCRResult(ctx, doc.ID, models.OCRStatusFailed, "", "", "OpenAI API key not configured", "")
		return
	}

	// Update status to processing
	_ = s.docRepo.UpdateOCRResult(ctx, doc.ID, models.OCRStatusProcessing, "", "", "", "")

	// Base64-encode file
	b64 := base64.StdEncoding.EncodeToString(fileData)
	mediaType := fileType
	if mediaType == "application/pdf" {
		// For PDF, we send as image anyway — GPT-4o handles it
		mediaType = "application/pdf"
	}
	dataURL := fmt.Sprintf("data:%s;base64,%s", mediaType, b64)

	systemPrompt := `You are a document analysis AI. Analyze the provided document and extract structured metadata.
Return ONLY a JSON object with:
{
    "document_type": "invoice|receipt|contract|deed|certificate|letter|id_document|bank_statement|tax_form|insurance|medical|other",
    "title": "brief descriptive title",
    "summary": "1-2 sentence summary",
    "dates": [{"label": "Issue Date", "value": "YYYY-MM-DD"}],
    "parties": [{"role": "Issuer", "name": "Company Name"}],
    "amounts": [{"label": "Total", "value": "100.00", "currency": "USD"}],
    "key_fields": {"invoice_number": "INV-001"},
    "language": "en",
    "confidence": 0-100
}`

	resp, err := s.aiClient.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: "gpt-4o",
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
			{
				Role: openai.ChatMessageRoleUser,
				MultiContent: []openai.ChatMessagePart{
					{
						Type: openai.ChatMessagePartTypeText,
						Text: "Analyze this document and extract structured metadata. Return only JSON.",
					},
					{
						Type: openai.ChatMessagePartTypeImageURL,
						ImageURL: &openai.ChatMessageImageURL{
							URL:    dataURL,
							Detail: openai.ImageURLDetailAuto,
						},
					},
				},
			},
		},
		Temperature: 0.2,
		MaxTokens:   2000,
	})

	if err != nil {
		log.Error().Err(err).Int64("doc_id", doc.ID).Msg("OCR processing failed")
		_ = s.docRepo.UpdateOCRResult(ctx, doc.ID, models.OCRStatusFailed, "", "", fmt.Sprintf("OpenAI API error: %v", err), "")
		return
	}

	rawText := strings.TrimSpace(resp.Choices[0].Message.Content)

	// Strip markdown code fences if present
	jsonStr := rawText
	if strings.HasPrefix(jsonStr, "```") {
		parts := strings.Split(jsonStr, "```")
		if len(parts) >= 2 {
			jsonStr = parts[1]
			if strings.HasPrefix(jsonStr, "json") {
				jsonStr = jsonStr[4:]
			}
			jsonStr = strings.TrimSpace(jsonStr)
		}
	}

	// Parse metadata
	var metadata models.DocumentMetadata
	if err := json.Unmarshal([]byte(jsonStr), &metadata); err != nil {
		log.Error().Err(err).Str("raw", rawText).Msg("Failed to parse OCR response")
		_ = s.docRepo.UpdateOCRResult(ctx, doc.ID, models.OCRStatusFailed, rawText, "", fmt.Sprintf("Failed to parse response: %v", err), "")
		return
	}

	metadataBytes, _ := json.Marshal(metadata)

	_ = s.docRepo.UpdateOCRResult(ctx, doc.ID, models.OCRStatusCompleted, rawText, string(metadataBytes), "", metadata.DocumentType)

	log.Info().Int64("doc_id", doc.ID).Str("document_type", metadata.DocumentType).Int("confidence", metadata.Confidence).Msg("OCR processing completed")
}

func (s *DocumentService) GetDocuments(ctx context.Context, walletAddress string) ([]models.SmartDocument, error) {
	return s.docRepo.GetByWalletAddress(ctx, walletAddress)
}

func (s *DocumentService) GetDocument(ctx context.Context, id int64, walletAddress string) (*models.SmartDocument, error) {
	doc, err := s.docRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if doc == nil {
		return nil, nil
	}
	if !strings.EqualFold(doc.WalletAddress, walletAddress) {
		return nil, fmt.Errorf("not authorized")
	}
	return doc, nil
}

func (s *DocumentService) DeleteDocument(ctx context.Context, id int64, walletAddress string) error {
	doc, err := s.docRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if doc == nil {
		return fmt.Errorf("document not found")
	}
	if !strings.EqualFold(doc.WalletAddress, walletAddress) {
		return fmt.Errorf("not authorized")
	}

	// Delete from S3
	if s.s3Client != nil {
		_, err := s.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(s.s3Bucket),
			Key:    aws.String(doc.S3Key),
		})
		if err != nil {
			log.Error().Err(err).Str("s3_key", doc.S3Key).Msg("Failed to delete from S3")
		}
	}

	// Delete from DB
	return s.docRepo.Delete(ctx, id)
}
