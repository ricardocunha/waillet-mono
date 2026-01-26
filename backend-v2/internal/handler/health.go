package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/waillet-app/backend-v2/internal/dto"
)

const Version = "1.0.0"

type HealthHandler struct {
	db *sqlx.DB
}

func NewHealthHandler(db *sqlx.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) Root(w http.ResponseWriter, r *http.Request) {
	resp := dto.HealthResponse{
		Status:    "healthy",
		Version:   Version,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	dbStatus := "connected"
	if err := h.db.Ping(); err != nil {
		dbStatus = "disconnected"
	}

	resp := dto.HealthResponse{
		Status:    "healthy",
		Version:   Version,
		Database:  dbStatus,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	if dbStatus == "disconnected" {
		resp.Status = "degraded"
		writeJSON(w, http.StatusServiceUnavailable, resp)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	resp := dto.ErrorResponse{
		Error:   http.StatusText(status),
		Message: message,
	}
	writeJSON(w, status, resp)
}
