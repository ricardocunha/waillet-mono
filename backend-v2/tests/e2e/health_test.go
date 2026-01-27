package e2e

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/waillet-app/backend-v2/internal/handler"
)

func TestHealthEndpoint(t *testing.T) {
	healthHandler := handler.NewHealthHandler(nil)

	r := chi.NewRouter()
	r.Get("/", healthHandler.Root)

	req, err := http.NewRequest(http.MethodGet, "/", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", rr.Code, http.StatusOK)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if status, ok := response["status"].(string); !ok || status != "healthy" {
		t.Errorf("expected status 'healthy', got %v", response["status"])
	}

	if _, ok := response["version"]; !ok {
		t.Error("expected version in response")
	}

	if _, ok := response["timestamp"]; !ok {
		t.Error("expected timestamp in response")
	}
}
