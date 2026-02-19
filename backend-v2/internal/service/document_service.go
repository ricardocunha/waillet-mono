package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

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
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
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

	// Generate thumbnail for image types
	s.generateAndUploadThumbnail(ctx, doc, fileData, fileType)

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

	var messages []openai.ChatCompletionMessage

	log.Info().Int64("doc_id", doc.ID).Str("file_type", fileType).Msg("[OCR] Starting OCR processing")

	// Determine the image data to send to the Vision API
	var imageData []byte
	var imageMime string

	if fileType == "application/pdf" {
		// For PDFs: render first page to PNG image, then use Vision API
		pngData, err := renderPDFFirstPage(fileData)
		if err != nil {
			log.Warn().Err(err).Int64("doc_id", doc.ID).Msg("[OCR] PDF rendering failed, falling back to text extraction")

			// Fallback: extract text and send as text-only prompt
			pdfText, textErr := extractPDFText(fileData)
			if textErr != nil || strings.TrimSpace(pdfText) == "" {
				errMsg := fmt.Sprintf("PDF rendering failed (%v) and text extraction yielded no content. Install poppler-utils (brew install poppler) for image-based PDF analysis.", err)
				_ = s.docRepo.UpdateOCRResult(ctx, doc.ID, models.OCRStatusFailed, "", "", errMsg, "")
				return
			}

			if len(pdfText) > 30000 {
				pdfText = pdfText[:30000] + "\n...[truncated]"
			}

			messages = []openai.ChatCompletionMessage{
				{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
				{
					Role:    openai.ChatMessageRoleUser,
					Content: fmt.Sprintf("Analyze the following document text and extract structured metadata. Return only JSON.\n\n---\n%s", pdfText),
				},
			}
		} else {
			log.Info().Int64("doc_id", doc.ID).Int("png_bytes", len(pngData)).Msg("[OCR] PDF rendered to PNG successfully")
			imageData = pngData
			imageMime = "image/png"
		}
	} else {
		imageData = fileData
		imageMime = fileType
	}

	// If we have image data, build the Vision API message
	if imageData != nil {
		b64 := base64.StdEncoding.EncodeToString(imageData)
		dataURL := fmt.Sprintf("data:%s;base64,%s", imageMime, b64)

		messages = []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
			{
				Role: openai.ChatMessageRoleUser,
				MultiContent: []openai.ChatMessagePart{
					{
						Type: openai.ChatMessagePartTypeText,
						Text: "Analyze this document image and extract ALL structured metadata you can see. Return only JSON.",
					},
					{
						Type: openai.ChatMessagePartTypeImageURL,
						ImageURL: &openai.ChatMessageImageURL{
							URL:    dataURL,
							Detail: openai.ImageURLDetailHigh,
						},
					},
				},
			},
		}
	}

	resp, err := s.aiClient.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model:       "gpt-4o",
		Messages:    messages,
		Temperature: 0.2,
		MaxTokens:   2000,
	})

	if err != nil {
		log.Error().Err(err).Int64("doc_id", doc.ID).Msg("OCR processing failed")
		_ = s.docRepo.UpdateOCRResult(ctx, doc.ID, models.OCRStatusFailed, "", "", fmt.Sprintf("OpenAI API error: %v", err), "")
		return
	}

	rawText := strings.TrimSpace(resp.Choices[0].Message.Content)

	log.Info().Int64("doc_id", doc.ID).Str("raw_response", rawText).Msg("[OCR] Full API response text")

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
	log.Info().Int64("doc_id", doc.ID).Str("json_to_parse", jsonStr).Msg("[OCR] Cleaned JSON for parsing")
	var metadata models.DocumentMetadata
	if err := json.Unmarshal([]byte(jsonStr), &metadata); err != nil {
		log.Error().Err(err).Str("raw", rawText).Msg("[OCR] Failed to parse OCR response")
		_ = s.docRepo.UpdateOCRResult(ctx, doc.ID, models.OCRStatusFailed, rawText, "", fmt.Sprintf("Failed to parse response: %v", err), "")
		return
	}

	metadataBytes, _ := json.Marshal(metadata)

	_ = s.docRepo.UpdateOCRResult(ctx, doc.ID, models.OCRStatusCompleted, rawText, string(metadataBytes), "", metadata.DocumentType)

	log.Info().Int64("doc_id", doc.ID).Str("document_type", metadata.DocumentType).Int("confidence", metadata.Confidence).Msg("OCR processing completed")
}

// renderPDFFirstPage converts the first page of a PDF to a PNG image using
// pdftoppm (poppler-utils) or ghostscript as a fallback.
func renderPDFFirstPage(fileData []byte) ([]byte, error) {
	// Write PDF to temp file
	tmpPDF, err := os.CreateTemp("", "doc-*.pdf")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpPDF.Name())

	if _, err := tmpPDF.Write(fileData); err != nil {
		tmpPDF.Close()
		return nil, fmt.Errorf("failed to write temp PDF: %w", err)
	}
	tmpPDF.Close()

	tmpDir, err := os.MkdirTemp("", "pdf-render-")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Try pdftoppm (poppler-utils) first
	outputPrefix := filepath.Join(tmpDir, "page")
	cmd := exec.Command("pdftoppm", "-png", "-f", "1", "-l", "1", "-r", "200", tmpPDF.Name(), outputPrefix)
	if err := cmd.Run(); err == nil {
		// pdftoppm outputs as page-1.png or page-01.png
		matches, _ := filepath.Glob(filepath.Join(tmpDir, "page-*.png"))
		if len(matches) > 0 {
			data, err := os.ReadFile(matches[0])
			if err == nil {
				log.Info().Str("tool", "pdftoppm").Int("png_size", len(data)).Msg("[PDF] Rendered PDF to PNG")
				return data, nil
			}
		}
	}

	// Try ghostscript as fallback
	outputFile := filepath.Join(tmpDir, "page.png")
	cmd = exec.Command("gs", "-dNOPAUSE", "-dBATCH", "-sDEVICE=png16m", "-r200",
		"-dFirstPage=1", "-dLastPage=1",
		fmt.Sprintf("-sOutputFile=%s", outputFile),
		tmpPDF.Name())
	if err := cmd.Run(); err == nil {
		data, err := os.ReadFile(outputFile)
		if err == nil {
			log.Info().Str("tool", "ghostscript").Int("png_size", len(data)).Msg("[PDF] Rendered PDF to PNG")
			return data, nil
		}
	}

	return nil, fmt.Errorf("no PDF renderer available. Install poppler-utils: brew install poppler")
}

// extractPDFText extracts selectable text from a PDF (fallback for when rendering tools are unavailable).
func extractPDFText(fileData []byte) (string, error) {
	// Write PDF to temp file and use pdftotext if available
	tmpPDF, err := os.CreateTemp("", "doc-*.pdf")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpPDF.Name())

	if _, err := tmpPDF.Write(fileData); err != nil {
		tmpPDF.Close()
		return "", err
	}
	tmpPDF.Close()

	// Try pdftotext (part of poppler-utils, same package as pdftoppm)
	cmd := exec.Command("pdftotext", tmpPDF.Name(), "-")
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err == nil && strings.TrimSpace(out.String()) != "" {
		return out.String(), nil
	}

	return "", fmt.Errorf("pdftotext not available or returned empty text")
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

func (s *DocumentService) GetPresignedURL(ctx context.Context, id int64, walletAddress string) (string, error) {
	doc, err := s.docRepo.GetByID(ctx, id)
	if err != nil {
		return "", err
	}
	if doc == nil {
		return "", fmt.Errorf("document not found")
	}
	if !strings.EqualFold(doc.WalletAddress, walletAddress) {
		return "", fmt.Errorf("not authorized")
	}
	if s.s3Client == nil {
		return "", fmt.Errorf("S3 client not configured")
	}

	presignClient := s3.NewPresignClient(s.s3Client)
	presignedReq, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.s3Bucket),
		Key:    aws.String(doc.S3Key),
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return presignedReq.URL, nil
}

func (s *DocumentService) RenameDocument(ctx context.Context, id int64, walletAddress, newTitle, newFileName string) (*models.SmartDocument, error) {
	doc, err := s.docRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if doc == nil {
		return nil, fmt.Errorf("document not found")
	}
	if !strings.EqualFold(doc.WalletAddress, walletAddress) {
		return nil, fmt.Errorf("not authorized")
	}

	// If no file_name change, just update the title
	if newFileName == "" || newFileName == doc.FileName {
		if err := s.docRepo.UpdateTitle(ctx, id, newTitle); err != nil {
			return nil, err
		}
		doc.Title = newTitle
		return doc, nil
	}

	// File rename: copy+delete in S3
	if s.s3Client == nil {
		return nil, fmt.Errorf("S3 client not configured")
	}

	// Build new S3 key: replace old filename with new filename in the existing key path
	// Key format: documents/{wallet}/{uuid}/{filename}
	keyParts := strings.SplitN(doc.S3Key, "/", 4) // ["documents", wallet, uuid, filename]
	if len(keyParts) < 4 {
		return nil, fmt.Errorf("unexpected S3 key format")
	}
	newS3Key := fmt.Sprintf("%s/%s/%s/%s", keyParts[0], keyParts[1], keyParts[2], newFileName)
	newS3URL := fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.s3Bucket, s.s3Region, newS3Key)

	// Copy to new key
	copySource := fmt.Sprintf("%s/%s", s.s3Bucket, doc.S3Key)
	_, err = s.s3Client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(s.s3Bucket),
		CopySource: aws.String(copySource),
		Key:        aws.String(newS3Key),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to copy S3 object: %w", err)
	}

	// Delete old key
	_, err = s.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.s3Bucket),
		Key:    aws.String(doc.S3Key),
	})
	if err != nil {
		log.Error().Err(err).Str("s3_key", doc.S3Key).Msg("Failed to delete old S3 object after copy")
	}

	// Handle thumbnail rename if exists
	newThumbnailKey := ""
	if doc.ThumbnailKey.Valid && doc.ThumbnailKey.String != "" {
		oldThumbKey := doc.ThumbnailKey.String
		// Thumbnail key format: thumbnails/{wallet}/{uuid}/{baseName}_thumb.jpg
		thumbParts := strings.SplitN(oldThumbKey, "/", 4)
		if len(thumbParts) >= 4 {
			baseName := strings.TrimSuffix(newFileName, filepath.Ext(newFileName))
			newThumbnailKey = fmt.Sprintf("%s/%s/%s/%s_thumb.jpg", thumbParts[0], thumbParts[1], thumbParts[2], baseName)

			// Copy thumbnail
			thumbCopySource := fmt.Sprintf("%s/%s", s.s3Bucket, oldThumbKey)
			_, err = s.s3Client.CopyObject(ctx, &s3.CopyObjectInput{
				Bucket:     aws.String(s.s3Bucket),
				CopySource: aws.String(thumbCopySource),
				Key:        aws.String(newThumbnailKey),
			})
			if err != nil {
				log.Error().Err(err).Msg("Failed to copy thumbnail in S3")
				newThumbnailKey = oldThumbKey // Keep old key on failure
			} else {
				// Delete old thumbnail
				_, _ = s.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
					Bucket: aws.String(s.s3Bucket),
					Key:    aws.String(oldThumbKey),
				})
			}
		}
	}

	// Update DB with all new info
	if err := s.docRepo.UpdateFileInfo(ctx, id, newTitle, newFileName, newS3Key, newS3URL, newThumbnailKey); err != nil {
		return nil, err
	}

	// Re-fetch to get updated fields
	updated, err := s.docRepo.GetByID(ctx, doc.ID)
	if err != nil || updated == nil {
		doc.Title = newTitle
		doc.FileName = newFileName
		doc.S3Key = newS3Key
		doc.S3URL = newS3URL
		return doc, nil
	}

	return updated, nil
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

		// Delete thumbnail from S3 if exists
		if doc.ThumbnailKey.Valid && doc.ThumbnailKey.String != "" {
			_, err := s.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
				Bucket: aws.String(s.s3Bucket),
				Key:    aws.String(doc.ThumbnailKey.String),
			})
			if err != nil {
				log.Error().Err(err).Str("thumbnail_key", doc.ThumbnailKey.String).Msg("Failed to delete thumbnail from S3")
			}
		}
	}

	// Delete from DB
	return s.docRepo.Delete(ctx, id)
}

func (s *DocumentService) generateAndUploadThumbnail(ctx context.Context, doc *models.SmartDocument, fileData []byte, fileType string) {
	log.Info().Int64("doc_id", doc.ID).Str("file_type", fileType).Msg("[Thumbnail] Starting thumbnail generation")

	if s.s3Client == nil {
		log.Warn().Int64("doc_id", doc.ID).Msg("[Thumbnail] Skipping — S3 client is nil")
		return
	}

	var imgData []byte

	if fileType == "application/pdf" {
		// Render PDF first page to PNG for thumbnail
		pngData, err := renderPDFFirstPage(fileData)
		if err != nil {
			log.Warn().Err(err).Int64("doc_id", doc.ID).Msg("[Thumbnail] Cannot render PDF — no thumbnail generated")
			return
		}
		imgData = pngData
	} else if strings.HasPrefix(fileType, "image/") {
		imgData = fileData
	} else {
		log.Info().Int64("doc_id", doc.ID).Msg("[Thumbnail] Skipping — unsupported file type")
		return
	}

	// Decode image
	img, format, err := image.Decode(bytes.NewReader(imgData))
	if err != nil {
		log.Error().Err(err).Int64("doc_id", doc.ID).Msg("[Thumbnail] Failed to decode image")
		return
	}
	log.Info().Int64("doc_id", doc.ID).Str("format", format).Msg("[Thumbnail] Image decoded successfully")

	// Resize to 200px width, maintaining aspect ratio
	bounds := img.Bounds()
	origWidth := bounds.Dx()
	origHeight := bounds.Dy()
	if origWidth == 0 {
		return
	}

	thumbWidth := 400
	thumbHeight := (origHeight * thumbWidth) / origWidth
	if thumbHeight == 0 {
		thumbHeight = 1
	}

	thumbImg := image.NewRGBA(image.Rect(0, 0, thumbWidth, thumbHeight))
	draw.BiLinear.Scale(thumbImg, thumbImg.Bounds(), img, bounds, draw.Over, nil)

	// Encode as JPEG quality 80
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, thumbImg, &jpeg.Options{Quality: 80}); err != nil {
		log.Error().Err(err).Int64("doc_id", doc.ID).Msg("Failed to encode thumbnail JPEG")
		return
	}

	// Build thumbnail S3 key
	// S3Key format: documents/{wallet}/{uuid}/{filename}
	keyParts := strings.SplitN(doc.S3Key, "/", 4)
	if len(keyParts) < 4 {
		return
	}
	baseName := strings.TrimSuffix(doc.FileName, filepath.Ext(doc.FileName))
	thumbnailKey := fmt.Sprintf("thumbnails/%s/%s/%s_thumb.jpg", keyParts[1], keyParts[2], baseName)
	log.Info().Int64("doc_id", doc.ID).Str("thumbnail_key", thumbnailKey).Int("thumb_bytes", buf.Len()).Msg("[Thumbnail] Uploading to S3")

	// Upload thumbnail to S3
	_, err = s.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.s3Bucket),
		Key:         aws.String(thumbnailKey),
		Body:        bytes.NewReader(buf.Bytes()),
		ContentType: aws.String("image/jpeg"),
	})
	if err != nil {
		log.Error().Err(err).Int64("doc_id", doc.ID).Msg("Failed to upload thumbnail to S3")
		return
	}

	// Save thumbnail key to DB
	if err := s.docRepo.UpdateThumbnailKey(ctx, doc.ID, thumbnailKey); err != nil {
		log.Error().Err(err).Int64("doc_id", doc.ID).Msg("Failed to save thumbnail key to DB")
		return
	}

	doc.ThumbnailKey.String = thumbnailKey
	doc.ThumbnailKey.Valid = true
	log.Info().Int64("doc_id", doc.ID).Str("thumbnail_key", thumbnailKey).Msg("Thumbnail generated and uploaded")
}

func (s *DocumentService) GenerateThumbnailURL(ctx context.Context, doc *models.SmartDocument) *string {
	if doc == nil || !doc.ThumbnailKey.Valid || doc.ThumbnailKey.String == "" {
		log.Debug().Int64("doc_id", doc.ID).Bool("valid", doc.ThumbnailKey.Valid).Str("key", doc.ThumbnailKey.String).Msg("[Thumbnail] No thumbnail_key for document")
		return nil
	}
	if s.s3Client == nil {
		return nil
	}

	presignClient := s3.NewPresignClient(s.s3Client)
	presignedReq, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.s3Bucket),
		Key:    aws.String(doc.ThumbnailKey.String),
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		log.Error().Err(err).Int64("doc_id", doc.ID).Msg("[Thumbnail] Failed to generate presigned URL")
		return nil
	}

	log.Info().Int64("doc_id", doc.ID).Str("thumbnail_url", presignedReq.URL[:80]+"...").Msg("[Thumbnail] Generated presigned URL")
	return &presignedReq.URL
}
