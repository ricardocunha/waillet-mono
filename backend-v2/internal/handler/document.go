package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/auth"
	"github.com/waillet-app/backend-v2/internal/dto"
	"github.com/waillet-app/backend-v2/internal/models"
	"github.com/waillet-app/backend-v2/internal/service"
)

const maxUploadSize = 10 << 20 // 10MB

var allowedFileTypes = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/webp":      true,
	"image/gif":       true,
	"application/pdf": true,
}

type DocumentHandler struct {
	service *service.DocumentService
}

func NewDocumentHandler(svc *service.DocumentService) *DocumentHandler {
	return &DocumentHandler{service: svc}
}

func (h *DocumentHandler) Upload(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "file too large (max 10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "no file provided")
		return
	}
	defer file.Close()

	fileType := header.Header.Get("Content-Type")
	if !allowedFileTypes[fileType] {
		writeError(w, http.StatusBadRequest, "unsupported file type (allowed: jpeg, png, webp, gif, pdf)")
		return
	}

	fileData, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read file")
		return
	}

	log.Info().
		Str("wallet_address", walletAddress).
		Str("file_name", header.Filename).
		Str("file_type", fileType).
		Int("file_size", len(fileData)).
		Msg("Uploading document")

	doc, err := h.service.UploadAndProcess(r.Context(), walletAddress, header.Filename, fileType, fileData)
	if err != nil {
		log.Error().Err(err).Msg("Failed to upload document")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	thumbURL := h.service.GenerateThumbnailURL(r.Context(), doc)
	hasThumb := thumbURL != nil
	log.Info().Int64("doc_id", doc.ID).Bool("has_thumbnail_url", hasThumb).Str("thumbnail_key", doc.ThumbnailKey.String).Msg("[Upload] Response thumbnail status")
	writeJSON(w, http.StatusCreated, toSmartDocumentResponse(doc, thumbURL))
}

func (h *DocumentHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	docs, err := h.service.GetDocuments(r.Context(), walletAddress)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get documents")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := make([]dto.SmartDocumentResponse, len(docs))
	for i, d := range docs {
		thumbURL := h.service.GenerateThumbnailURL(r.Context(), &d)
		response[i] = toSmartDocumentResponse(&d, thumbURL)
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *DocumentHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	doc, err := h.service.GetDocument(r.Context(), id, walletAddress)
	if err != nil {
		if strings.Contains(err.Error(), "not authorized") {
			writeError(w, http.StatusForbidden, "not authorized to access this document")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if doc == nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	thumbURL := h.service.GenerateThumbnailURL(r.Context(), doc)
	writeJSON(w, http.StatusOK, toSmartDocumentResponse(doc, thumbURL))
}

func (h *DocumentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.service.DeleteDocument(r.Context(), id, walletAddress); err != nil {
		if strings.Contains(err.Error(), "not authorized") {
			writeError(w, http.StatusForbidden, "not authorized to delete this document")
			return
		}
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, "document not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "document deleted",
	})
}

func (h *DocumentHandler) GetPresignedURL(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	url, err := h.service.GetPresignedURL(r.Context(), id, walletAddress)
	if err != nil {
		if strings.Contains(err.Error(), "not authorized") {
			writeError(w, http.StatusForbidden, "not authorized")
			return
		}
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, "document not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

func (h *DocumentHandler) Rename(w http.ResponseWriter, r *http.Request) {
	walletAddress := auth.WalletFromContext(r.Context())
	if walletAddress == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var body struct {
		Title    string `json:"title"`
		FileName string `json:"file_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(body.Title) == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	doc, err := h.service.RenameDocument(r.Context(), id, walletAddress, strings.TrimSpace(body.Title), strings.TrimSpace(body.FileName))
	if err != nil {
		if strings.Contains(err.Error(), "not authorized") {
			writeError(w, http.StatusForbidden, "not authorized")
			return
		}
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, "document not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	thumbURL := h.service.GenerateThumbnailURL(r.Context(), doc)
	writeJSON(w, http.StatusOK, toSmartDocumentResponse(doc, thumbURL))
}

func toSmartDocumentResponse(doc *models.SmartDocument, thumbnailURL *string) dto.SmartDocumentResponse {
	resp := dto.SmartDocumentResponse{
		ID:            doc.ID,
		WalletAddress: doc.WalletAddress,
		Title:         doc.Title,
		FileName:      doc.FileName,
		FileType:      doc.FileType,
		FileSize:      doc.FileSize,
		S3URL:         doc.S3URL,
		OCRStatus:     string(doc.OCRStatus),
		ThumbnailURL:  thumbnailURL,
		CreatedAt:     doc.CreatedAt,
		UpdatedAt:     doc.UpdatedAt,
	}

	if doc.DocumentType.Valid {
		resp.DocumentType = &doc.DocumentType.String
	}
	if doc.OCRError.Valid {
		resp.OCRError = &doc.OCRError.String
	}

	if doc.MetadataJSON.Valid && doc.MetadataJSON.String != "" {
		var metadata dto.DocumentMetadataDTO
		if err := json.Unmarshal([]byte(doc.MetadataJSON.String), &metadata); err == nil {
			resp.Metadata = &metadata
		}
	}

	return resp
}
