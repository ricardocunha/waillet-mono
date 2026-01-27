package unit

import (
	"testing"

	"github.com/waillet-app/backend-v2/internal/models"
)

func TestGetRiskLevel(t *testing.T) {
	tests := []struct {
		name     string
		score    int
		expected models.RiskLevel
	}{
		{"zero score", 0, models.RiskLevelLow},
		{"low boundary", 30, models.RiskLevelLow},
		{"medium lower boundary", 31, models.RiskLevelMedium},
		{"medium middle", 50, models.RiskLevelMedium},
		{"medium upper boundary", 70, models.RiskLevelMedium},
		{"high lower boundary", 71, models.RiskLevelHigh},
		{"high score", 100, models.RiskLevelHigh},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := models.GetRiskLevel(tt.score)
			if result != tt.expected {
				t.Errorf("GetRiskLevel(%d) = %v, want %v", tt.score, result, tt.expected)
			}
		})
	}
}

func TestIsValidChain(t *testing.T) {
	tests := []struct {
		name     string
		chain    string
		expected bool
	}{
		{"ethereum", "ethereum", true},
		{"sepolia", "sepolia", true},
		{"base", "base", true},
		{"base-sepolia", "base-sepolia", true},
		{"bsc", "bsc", true},
		{"bsc-testnet", "bsc-testnet", true},
		{"polygon", "polygon", true},
		{"arbitrum", "arbitrum", true},
		{"optimism", "optimism", true},
		{"invalid chain", "invalid", false},
		{"empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := models.IsValidChain(tt.chain)
			if result != tt.expected {
				t.Errorf("IsValidChain(%s) = %v, want %v", tt.chain, result, tt.expected)
			}
		})
	}
}
