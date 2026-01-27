package unit

import (
	"testing"

	"github.com/waillet-app/backend-v2/pkg/validator"
)

func TestIsValidEthereumAddress(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		expected bool
	}{
		{"valid lowercase", "0x742d35cc6634c0532925a3b844bc9e7595f5e5b6", true},
		{"valid uppercase", "0x742D35CC6634C0532925A3B844BC9E7595F5E5B6", true},
		{"valid mixed case", "0x742d35Cc6634C0532925A3b844Bc9e7595F5e5b6", true},
		{"no prefix", "742d35cc6634c0532925a3b844bc9e7595f5e5b6", false},
		{"short address", "0x742d35cc6634c0532925a3b844bc9e7595f5e5", false},
		{"long address", "0x742d35cc6634c0532925a3b844bc9e7595f5e5b6a", false},
		{"invalid characters", "0x742d35cc6634c0532925a3b844bc9e7595f5e5gz", false},
		{"empty string", "", false},
		{"null address", "0x0000000000000000000000000000000000000000", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.IsValidEthereumAddress(tt.address)
			if result != tt.expected {
				t.Errorf("IsValidEthereumAddress(%s) = %v, want %v", tt.address, result, tt.expected)
			}
		})
	}
}

func TestNormalizeAddress(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		expected string
	}{
		{"uppercase to lowercase", "0x742D35CC6634C0532925A3B844BC9E7595F5E5B6", "0x742d35cc6634c0532925a3b844bc9e7595f5e5b6"},
		{"mixed case to lowercase", "0x742d35Cc6634C0532925A3b844Bc9e7595F5e5b6", "0x742d35cc6634c0532925a3b844bc9e7595f5e5b6"},
		{"already lowercase", "0x742d35cc6634c0532925a3b844bc9e7595f5e5b6", "0x742d35cc6634c0532925a3b844bc9e7595f5e5b6"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.NormalizeAddress(tt.address)
			if result != tt.expected {
				t.Errorf("NormalizeAddress(%s) = %v, want %v", tt.address, result, tt.expected)
			}
		})
	}
}

func TestPadAddress(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		expected string
	}{
		{"already padded", "0x742d35cc6634c0532925a3b844bc9e7595f5e5b6", "0x742d35cc6634c0532925a3b844bc9e7595f5e5b6"},
		{"needs padding", "0x1", "0x0000000000000000000000000000000000000001"},
		{"no prefix needs padding", "1", "0x0000000000000000000000000000000000000001"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.PadAddress(tt.address)
			if result != tt.expected {
				t.Errorf("PadAddress(%s) = %v, want %v", tt.address, result, tt.expected)
			}
		})
	}
}

func TestIsValidTxHash(t *testing.T) {
	tests := []struct {
		name     string
		hash     string
		expected bool
	}{
		{"valid hash", "0x9fc76417374aa880d4449a1f7f31ec597f00b1f6f3dd2d66f4c9c6c445836d8b", true},
		{"no prefix", "9fc76417374aa880d4449a1f7f31ec597f00b1f6f3dd2d66f4c9c6c445836d8b", false},
		{"short hash", "0x9fc76417374aa880d4449a1f7f31ec597f00b1f6f3dd2d66f4c9c6c445836d8", false},
		{"long hash", "0x9fc76417374aa880d4449a1f7f31ec597f00b1f6f3dd2d66f4c9c6c445836d8b1", false},
		{"invalid characters", "0x9fc76417374aa880d4449a1f7f31ec597f00b1f6f3dd2d66f4c9c6c445836dgz", false},
		{"empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.IsValidTxHash(tt.hash)
			if result != tt.expected {
				t.Errorf("IsValidTxHash(%s) = %v, want %v", tt.hash, result, tt.expected)
			}
		})
	}
}

func TestIsHexData(t *testing.T) {
	tests := []struct {
		name     string
		data     string
		expected bool
	}{
		{"empty string", "", true},
		{"0x only", "0x", true},
		{"valid transfer data", "0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f5e5b60000000000000000000000000000000000000000000000000de0b6b3a7640000", true},
		{"no prefix", "a9059cbb", false},
		{"invalid characters", "0xghij", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.IsHexData(tt.data)
			if result != tt.expected {
				t.Errorf("IsHexData(%s) = %v, want %v", tt.data, result, tt.expected)
			}
		})
	}
}
