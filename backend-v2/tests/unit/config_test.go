package unit

import (
	"os"
	"testing"

	"github.com/waillet-app/backend-v2/internal/config"
)

func TestConfigLoad(t *testing.T) {
	os.Setenv("HOST", "127.0.0.1")
	os.Setenv("PORT", "9000")
	os.Setenv("DEBUG", "true")
	os.Setenv("DB_HOST", "testhost")
	os.Setenv("DB_PORT", "3307")
	os.Setenv("DB_USER", "testuser")
	os.Setenv("DB_PASSWORD", "testpass")
	os.Setenv("DB_NAME", "testdb")
	os.Setenv("OPENAI_API_KEY", "sk-test-key")
	os.Setenv("ALCHEMY_API_KEY", "test-alchemy-key")

	defer func() {
		os.Unsetenv("HOST")
		os.Unsetenv("PORT")
		os.Unsetenv("DEBUG")
		os.Unsetenv("DB_HOST")
		os.Unsetenv("DB_PORT")
		os.Unsetenv("DB_USER")
		os.Unsetenv("DB_PASSWORD")
		os.Unsetenv("DB_NAME")
		os.Unsetenv("OPENAI_API_KEY")
		os.Unsetenv("ALCHEMY_API_KEY")
	}()

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("config.Load() error = %v", err)
	}

	if cfg.Server.Host != "127.0.0.1" {
		t.Errorf("Server.Host = %v, want 127.0.0.1", cfg.Server.Host)
	}

	if cfg.Server.Port != 9000 {
		t.Errorf("Server.Port = %v, want 9000", cfg.Server.Port)
	}

	if cfg.Server.Debug != true {
		t.Errorf("Server.Debug = %v, want true", cfg.Server.Debug)
	}

	if cfg.Database.Host != "testhost" {
		t.Errorf("Database.Host = %v, want testhost", cfg.Database.Host)
	}

	if cfg.Database.Port != 3307 {
		t.Errorf("Database.Port = %v, want 3307", cfg.Database.Port)
	}

	if cfg.Database.User != "testuser" {
		t.Errorf("Database.User = %v, want testuser", cfg.Database.User)
	}

	if cfg.OpenAI.APIKey != "sk-test-key" {
		t.Errorf("OpenAI.APIKey = %v, want sk-test-key", cfg.OpenAI.APIKey)
	}

	if cfg.RPC.AlchemyAPIKey != "test-alchemy-key" {
		t.Errorf("RPC.AlchemyAPIKey = %v, want test-alchemy-key", cfg.RPC.AlchemyAPIKey)
	}
}

func TestConfigDefaults(t *testing.T) {
	os.Clearenv()

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("config.Load() error = %v", err)
	}

	if cfg.Server.Host != "0.0.0.0" {
		t.Errorf("Server.Host default = %v, want 0.0.0.0", cfg.Server.Host)
	}

	if cfg.Server.Port != 8000 {
		t.Errorf("Server.Port default = %v, want 8000", cfg.Server.Port)
	}

	if cfg.Database.Host != "localhost" {
		t.Errorf("Database.Host default = %v, want localhost", cfg.Database.Host)
	}

	if cfg.Database.Port != 3306 {
		t.Errorf("Database.Port default = %v, want 3306", cfg.Database.Port)
	}

	if cfg.OpenAI.Model != "gpt-4o-mini" {
		t.Errorf("OpenAI.Model default = %v, want gpt-4o-mini", cfg.OpenAI.Model)
	}
}
