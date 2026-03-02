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

		`CREATE TABLE IF NOT EXISTS smart_documents (
			id INT AUTO_INCREMENT PRIMARY KEY,
			wallet_address VARCHAR(42) NOT NULL,
			title VARCHAR(255) NOT NULL DEFAULT '',
			file_name VARCHAR(255) NOT NULL,
			file_type VARCHAR(50) NOT NULL,
			file_size INT NOT NULL,
			s3_key VARCHAR(500) NOT NULL,
			s3_url VARCHAR(1000) NOT NULL,
			document_type VARCHAR(100) DEFAULT NULL,
			ocr_status ENUM('pending','processing','completed','failed') DEFAULT 'pending',
			ocr_raw_text TEXT DEFAULT NULL,
			metadata_json JSON DEFAULT NULL,
			ocr_error TEXT DEFAULT NULL,
			thumbnail_key VARCHAR(500) DEFAULT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_wallet_documents (wallet_address),
			INDEX idx_ocr_status (ocr_status),
			INDEX idx_document_type (document_type)
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

		`CREATE TABLE IF NOT EXISTS document_shares (
			id INT AUTO_INCREMENT PRIMARY KEY,
			document_id INT NOT NULL,
			document_hash VARCHAR(66) NOT NULL,
			owner_address VARCHAR(42) NOT NULL,
			recipient_address VARCHAR(42) NOT NULL,
			token_id INT DEFAULT NULL,
			tx_hash VARCHAR(66) DEFAULT NULL,
			expires_at TIMESTAMP NOT NULL,
			status ENUM('pending','active','revoked','expired') DEFAULT 'pending',
			revoke_tx_hash VARCHAR(66) DEFAULT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (document_id) REFERENCES smart_documents(id) ON DELETE CASCADE,
			INDEX idx_shares_doc (document_id),
			INDEX idx_shares_recipient (recipient_address),
			INDEX idx_shares_status (status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	}

	for i, stmt := range statements {
		_, err := db.Exec(stmt)
		if err != nil {
			return fmt.Errorf("failed to run migration statement %d: %w", i+1, err)
		}
	}

	// Add thumbnail_key column to smart_documents if it doesn't exist
	alterStatements := []string{
		`ALTER TABLE smart_documents ADD COLUMN thumbnail_key VARCHAR(500) DEFAULT NULL`,
	}
	for _, stmt := range alterStatements {
		_, _ = db.Exec(stmt) // Ignore errors (column may already exist)
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

	// CoinMarketCap logo URL format: https://s2.coinmarketcap.com/static/img/coins/64x64/{cmc_id}.png
	// CMC IDs for native/governance tokens:
	// L1: ETH=1027, BNB=1839, POL=3890, AVAX=5805, FTM=3513, CRO=3635, GNO=1659, CELO=5567, GLMR=6836, KAVA=4846, ONE=3945
	// L2 Optimistic: ARB=11841, OP=11840, MNT=27075, METIS=9640, BLAST=28480, MODE=30915
	// L2 ZK: ZK=24091, SCR=26998, MANTA=13631
	const (
		ethIcon    = "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png"
		bnbIcon    = "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png"
		polIcon    = "https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png"
		avaxIcon   = "https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png"
		ftmIcon    = "https://s2.coinmarketcap.com/static/img/coins/64x64/3513.png"
		croIcon    = "https://s2.coinmarketcap.com/static/img/coins/64x64/3635.png"
		gnoIcon    = "https://s2.coinmarketcap.com/static/img/coins/64x64/1659.png"
		celoIcon   = "https://s2.coinmarketcap.com/static/img/coins/64x64/5567.png"
		glmrIcon   = "https://s2.coinmarketcap.com/static/img/coins/64x64/6836.png"
		kavaIcon   = "https://s2.coinmarketcap.com/static/img/coins/64x64/4846.png"
		oneIcon    = "https://s2.coinmarketcap.com/static/img/coins/64x64/3945.png"
		arbIcon    = "https://s2.coinmarketcap.com/static/img/coins/64x64/11841.png"
		opIcon     = "https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png"
		baseIcon   = "https://s2.coinmarketcap.com/static/img/coins/64x64/27716.png"
		mntIcon    = "https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png"
		metisIcon  = "https://s2.coinmarketcap.com/static/img/coins/64x64/9640.png"
		blastIcon  = "https://s2.coinmarketcap.com/static/img/coins/64x64/28480.png"
		modeIcon   = "https://s2.coinmarketcap.com/static/img/coins/64x64/30915.png"
		zkIcon     = "https://s2.coinmarketcap.com/static/img/coins/64x64/24091.png"
		scrollIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/26998.png"
		mantaIcon  = "https://s2.coinmarketcap.com/static/img/coins/64x64/13631.png"
	)

	networks := []struct {
		slug, name                               string
		chainID                                  int
		rpcURL, rpcURLFallback, explorerURL      string
		nativeCurrencySymbol, nativeCurrencyName string
		isTestnet                                bool
		displayColor                             string
		iconURL                                  string
		sortOrder                                int
	}{
		// Major L1 Networks
		{"ethereum", "Ethereum", 1, "https://eth-mainnet.g.alchemy.com/v2/", "https://eth.llamarpc.com", "https://etherscan.io", "ETH", "Ether", false, "#627EEA", ethIcon, 1},
		{"bsc", "BNB Smart Chain", 56, "https://bsc-dataseed1.binance.org", "https://bsc-dataseed.binance.org", "https://bscscan.com", "BNB", "BNB", false, "#F0B90B", bnbIcon, 2},
		{"polygon", "Polygon", 137, "https://polygon-mainnet.g.alchemy.com/v2/", "https://polygon-rpc.com", "https://polygonscan.com", "POL", "POL", false, "#8247E5", polIcon, 3},
		{"avalanche", "Avalanche C-Chain", 43114, "https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain.publicnode.com", "https://snowtrace.io", "AVAX", "Avalanche", false, "#E84142", avaxIcon, 4},
		{"fantom", "Fantom Opera", 250, "https://rpc.ftm.tools", "https://fantom-rpc.publicnode.com", "https://ftmscan.com", "FTM", "Fantom", false, "#1969FF", ftmIcon, 5},
		{"cronos", "Cronos", 25, "https://evm.cronos.org", "https://cronos-rpc.publicnode.com", "https://cronoscan.com", "CRO", "Cronos", false, "#002D74", croIcon, 6},
		{"gnosis", "Gnosis Chain", 100, "https://rpc.gnosischain.com", "https://gnosis-rpc.publicnode.com", "https://gnosisscan.io", "xDAI", "xDAI", false, "#04795B", gnoIcon, 7},
		{"celo", "Celo", 42220, "https://forno.celo.org", "https://celo-rpc.publicnode.com", "https://celoscan.io", "CELO", "Celo", false, "#35D07F", celoIcon, 8},
		{"moonbeam", "Moonbeam", 1284, "https://rpc.api.moonbeam.network", "https://moonbeam-rpc.publicnode.com", "https://moonscan.io", "GLMR", "Glimmer", false, "#53CBC9", glmrIcon, 9},
		{"kava", "Kava EVM", 2222, "https://evm.kava.io", "https://kava-rpc.publicnode.com", "https://kavascan.com", "KAVA", "Kava", false, "#FF433E", kavaIcon, 10},
		{"harmony", "Harmony", 1666600000, "https://api.harmony.one", "https://harmony-rpc.publicnode.com", "https://explorer.harmony.one", "ONE", "ONE", false, "#00AEE9", oneIcon, 11},

		// L2 Networks (Optimistic Rollups) - use governance token icons
		{"arbitrum", "Arbitrum One", 42161, "https://arb-mainnet.g.alchemy.com/v2/", "https://arb1.arbitrum.io/rpc", "https://arbiscan.io", "ETH", "Ether", false, "#28A0F0", arbIcon, 20},
		{"optimism", "Optimism", 10, "https://opt-mainnet.g.alchemy.com/v2/", "https://mainnet.optimism.io", "https://optimistic.etherscan.io", "ETH", "Ether", false, "#FF0420", opIcon, 21},
		{"base", "Base", 8453, "https://base-mainnet.g.alchemy.com/v2/", "https://mainnet.base.org", "https://basescan.org", "ETH", "Ether", false, "#0052FF", baseIcon, 22},
		{"mantle", "Mantle", 5000, "https://rpc.mantle.xyz", "https://mantle-rpc.publicnode.com", "https://mantlescan.xyz", "MNT", "Mantle", false, "#000000", mntIcon, 23},
		{"metis", "Metis Andromeda", 1088, "https://andromeda.metis.io/?owner=1088", "https://metis-pokt.nodies.app", "https://andromeda-explorer.metis.io", "METIS", "Metis", false, "#00DACC", metisIcon, 24},
		{"blast", "Blast", 81457, "https://rpc.blast.io", "https://blast-rpc.publicnode.com", "https://blastscan.io", "ETH", "Ether", false, "#FCFC03", blastIcon, 25},
		{"mode", "Mode", 34443, "https://mainnet.mode.network", "https://mode-rpc.publicnode.com", "https://modescan.io", "ETH", "Ether", false, "#DFFE00", modeIcon, 26},

		// L2 Networks (ZK Rollups) - use governance token icons where available
		{"zksync", "zkSync Era", 324, "https://mainnet.era.zksync.io", "https://zksync-era-rpc.publicnode.com", "https://explorer.zksync.io", "ETH", "Ether", false, "#8C8DFC", zkIcon, 30},
		{"linea", "Linea", 59144, "https://linea-mainnet.g.alchemy.com/v2/", "https://rpc.linea.build", "https://lineascan.build", "ETH", "Ether", false, "#61DFFF", ethIcon, 31},
		{"polygon-zkevm", "Polygon zkEVM", 1101, "https://polygonzkevm-mainnet.g.alchemy.com/v2/", "https://zkevm-rpc.com", "https://zkevm.polygonscan.com", "ETH", "Ether", false, "#8247E5", polIcon, 32},
		{"scroll", "Scroll", 534352, "https://rpc.scroll.io", "https://scroll-rpc.publicnode.com", "https://scrollscan.com", "ETH", "Ether", false, "#FFEEDA", scrollIcon, 33},
		{"manta", "Manta Pacific", 169, "https://pacific-rpc.manta.network/http", "https://manta-pacific-rpc.publicnode.com", "https://pacific-explorer.manta.network", "ETH", "Ether", false, "#0091FF", mantaIcon, 34},

		// Testnets
		{"sepolia", "Sepolia Testnet", 11155111, "https://eth-sepolia.g.alchemy.com/v2/", "https://rpc2.sepolia.org", "https://sepolia.etherscan.io", "ETH", "Sepolia ETH", true, "#A855F7", ethIcon, 100},
		{"base-sepolia", "Base Sepolia", 84532, "https://base-sepolia.g.alchemy.com/v2/", "https://sepolia.base.org", "https://sepolia.basescan.org", "ETH", "Sepolia ETH", true, "#0052FF", baseIcon, 101},
	}

	query := `INSERT INTO networks (slug, name, chain_id, rpc_url, rpc_url_fallback, explorer_url,
		native_currency_symbol, native_currency_name, is_testnet, display_color, icon_url, sort_order)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	for _, n := range networks {
		_, err := db.Exec(query, n.slug, n.name, n.chainID, n.rpcURL, n.rpcURLFallback, n.explorerURL,
			n.nativeCurrencySymbol, n.nativeCurrencyName, n.isTestnet, n.displayColor, n.iconURL, n.sortOrder)
		if err != nil {
			log.Warn().Err(err).Str("network", n.slug).Msg("Failed to seed network")
		}
	}

	log.Info().Int("count", len(networks)).Msg("Seeded default networks")
}
