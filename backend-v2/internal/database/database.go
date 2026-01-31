package database

import (
	"fmt"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/config"
)

func NewConnection(cfg *config.DatabaseConfig) (*sqlx.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&multiStatements=true",
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
	// Run each CREATE TABLE statement separately to avoid MySQL parsing issues
	statements := []string{
		`CREATE TABLE IF NOT EXISTS favorites (
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
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS policies (
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
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS risk_logs (
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
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS networks (
			id INT AUTO_INCREMENT PRIMARY KEY,
			slug VARCHAR(50) NOT NULL UNIQUE,
			name VARCHAR(100) NOT NULL,
			chain_id INT NOT NULL UNIQUE,
			rpc_url VARCHAR(500) NOT NULL,
			rpc_url_fallback VARCHAR(500) DEFAULT NULL,
			explorer_url VARCHAR(200) NOT NULL,
			native_currency_symbol VARCHAR(10) NOT NULL,
			native_currency_name VARCHAR(50) NOT NULL,
			native_currency_decimals INT DEFAULT 18,
			is_testnet BOOLEAN DEFAULT FALSE,
			is_active BOOLEAN DEFAULT TRUE,
			display_color VARCHAR(7) DEFAULT '#6B7280',
			icon_url VARCHAR(500) DEFAULT NULL,
			sort_order INT DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_chain_id (chain_id),
			INDEX idx_slug (slug),
			INDEX idx_is_active (is_active)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS tokens (
			id INT AUTO_INCREMENT PRIMARY KEY,
			cmc_id INT NOT NULL UNIQUE,
			symbol VARCHAR(20) NOT NULL,
			name VARCHAR(100) NOT NULL,
			slug VARCHAR(100) NOT NULL,
			cmc_rank INT DEFAULT NULL,
			price_usd DECIMAL(30, 18) DEFAULT NULL,
			market_cap_usd DECIMAL(30, 2) DEFAULT NULL,
			volume_24h_usd DECIMAL(30, 2) DEFAULT NULL,
			percent_change_24h DECIMAL(10, 4) DEFAULT NULL,
			percent_change_7d DECIMAL(10, 4) DEFAULT NULL,
			circulating_supply DECIMAL(30, 2) DEFAULT NULL,
			total_supply DECIMAL(30, 2) DEFAULT NULL,
			logo_url VARCHAR(500) DEFAULT NULL,
			is_active BOOLEAN DEFAULT TRUE,
			last_price_update TIMESTAMP DEFAULT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_cmc_id (cmc_id),
			INDEX idx_symbol (symbol),
			INDEX idx_cmc_rank (cmc_rank),
			INDEX idx_is_active (is_active)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS token_addresses (
			id INT AUTO_INCREMENT PRIMARY KEY,
			token_id INT NOT NULL,
			network_id INT NOT NULL,
			contract_address VARCHAR(66) NOT NULL,
			decimals INT DEFAULT 18,
			is_native BOOLEAN DEFAULT FALSE,
			is_verified BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE,
			FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE,
			UNIQUE KEY unique_token_network (token_id, network_id),
			INDEX idx_network_id (network_id),
			INDEX idx_contract_address (contract_address)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS auth_nonces (
			id INT AUTO_INCREMENT PRIMARY KEY,
			wallet_address VARCHAR(42) NOT NULL,
			nonce VARCHAR(64) NOT NULL UNIQUE,
			expires_at TIMESTAMP NOT NULL,
			used BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_wallet_nonce (wallet_address),
			INDEX idx_expires (expires_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	}

	for i, stmt := range statements {
		_, err := db.Exec(stmt)
		if err != nil {
			return fmt.Errorf("failed to run migration statement %d: %w", i+1, err)
		}
	}

	// Seed default networks (only if table is empty)
	seedNetworks(db)

	log.Info().Msg("Database migrations completed")
	return nil
}

func seedNetworks(db *sqlx.DB) {
	// Check if networks table has data
	var count int
	err := db.Get(&count, "SELECT COUNT(*) FROM networks")
	if err != nil || count > 0 {
		return // Table has data or error, skip seeding
	}

	networks := []struct {
		slug, name                               string
		chainID                                  int
		rpcURL, rpcURLFallback, explorerURL      string
		nativeCurrencySymbol, nativeCurrencyName string
		isTestnet                                bool
		displayColor                             string
		sortOrder                                int
	}{
		{"ethereum", "Ethereum", 1, "https://eth-mainnet.g.alchemy.com/v2/", "https://eth.llamarpc.com", "https://etherscan.io", "ETH", "Ether", false, "#627EEA", 1},
		{"bsc", "BNB Smart Chain", 56, "https://bsc-dataseed1.binance.org", "https://bsc-dataseed.binance.org", "https://bscscan.com", "BNB", "BNB", false, "#F0B90B", 2},
		{"base", "Base", 8453, "https://base-mainnet.g.alchemy.com/v2/", "https://mainnet.base.org", "https://basescan.org", "ETH", "Ether", false, "#0052FF", 3},
		{"polygon", "Polygon", 137, "https://polygon-mainnet.g.alchemy.com/v2/", "https://polygon-rpc.com", "https://polygonscan.com", "MATIC", "MATIC", false, "#8247E5", 4},
		{"sepolia", "Sepolia Testnet", 11155111, "https://eth-sepolia.g.alchemy.com/v2/", "https://rpc2.sepolia.org", "https://sepolia.etherscan.io", "ETH", "Sepolia ETH", true, "#A855F7", 100},
		{"base-sepolia", "Base Sepolia", 84532, "https://base-sepolia.g.alchemy.com/v2/", "https://sepolia.base.org", "https://sepolia.basescan.org", "ETH", "Sepolia ETH", true, "#0052FF", 101},
	}

	query := `INSERT INTO networks (slug, name, chain_id, rpc_url, rpc_url_fallback, explorer_url,
		native_currency_symbol, native_currency_name, is_testnet, display_color, sort_order)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	for _, n := range networks {
		_, err := db.Exec(query, n.slug, n.name, n.chainID, n.rpcURL, n.rpcURLFallback, n.explorerURL,
			n.nativeCurrencySymbol, n.nativeCurrencyName, n.isTestnet, n.displayColor, n.sortOrder)
		if err != nil {
			log.Warn().Err(err).Str("network", n.slug).Msg("Failed to seed network")
		}
	}

	log.Info().Int("count", len(networks)).Msg("Seeded default networks")
}
