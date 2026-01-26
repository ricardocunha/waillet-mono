package database

import (
	"fmt"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/config"
)

func NewConnection(cfg *config.DatabaseConfig) (*sqlx.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName)

	db, err := sqlx.Connect("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Info().
		Str("host", cfg.Host).
		Int("port", cfg.Port).
		Str("database", cfg.DBName).
		Msg("Connected to MySQL database")

	return db, nil
}

func RunMigrations(db *sqlx.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS favorites (
		id INT AUTO_INCREMENT PRIMARY KEY,
		wallet_address VARCHAR(42) NOT NULL,
		alias VARCHAR(100) NOT NULL,
		address VARCHAR(42) NOT NULL,
		asset VARCHAR(50) DEFAULT NULL,
		type ENUM('address', 'contract', 'token') DEFAULT 'address',
		value VARCHAR(255) DEFAULT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_wallet_address (wallet_address),
		UNIQUE KEY unique_wallet_alias (wallet_address, alias)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

	CREATE TABLE IF NOT EXISTS policies (
		id INT AUTO_INCREMENT PRIMARY KEY,
		wallet_address VARCHAR(42) NOT NULL,
		policy_type ENUM('allowlist', 'spending_limit', 'contract_block') NOT NULL,
		target_address VARCHAR(42) DEFAULT NULL,
		chain VARCHAR(50) NOT NULL,
		limit_amount DECIMAL(65,18) DEFAULT NULL,
		is_active BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_wallet_policy (wallet_address, policy_type)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

	CREATE TABLE IF NOT EXISTS risk_logs (
		id INT AUTO_INCREMENT PRIMARY KEY,
		wallet_address VARCHAR(42) NOT NULL,
		tx_hash VARCHAR(66) DEFAULT NULL,
		method VARCHAR(100) NOT NULL,
		params TEXT,
		risk_score INT DEFAULT 0,
		ai_summary TEXT,
		decision ENUM('approved', 'blocked', 'pending') DEFAULT 'pending',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		INDEX idx_wallet_logs (wallet_address, created_at)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	log.Info().Msg("Database migrations completed")
	return nil
}
