-- Networks table: stores blockchain network configurations
CREATE TABLE IF NOT EXISTS networks (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tokens table: stores cryptocurrency token information from CoinMarketCap
CREATE TABLE IF NOT EXISTS tokens (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Token addresses table: maps tokens to their contract addresses on different networks
CREATE TABLE IF NOT EXISTS token_addresses (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default networks
INSERT INTO networks (slug, name, chain_id, rpc_url, rpc_url_fallback, explorer_url, native_currency_symbol, native_currency_name, is_testnet, display_color, sort_order) VALUES
('ethereum', 'Ethereum', 1, 'https://eth-mainnet.g.alchemy.com/v2/', 'https://eth.llamarpc.com', 'https://etherscan.io', 'ETH', 'Ether', FALSE, '#627EEA', 1),
('bsc', 'BNB Smart Chain', 56, 'https://bsc-dataseed1.binance.org', 'https://bsc-dataseed.binance.org', 'https://bscscan.com', 'BNB', 'BNB', FALSE, '#F0B90B', 2),
('base', 'Base', 8453, 'https://base-mainnet.g.alchemy.com/v2/', 'https://mainnet.base.org', 'https://basescan.org', 'ETH', 'Ether', FALSE, '#0052FF', 3),
('polygon', 'Polygon', 137, 'https://polygon-mainnet.g.alchemy.com/v2/', 'https://polygon-rpc.com', 'https://polygonscan.com', 'MATIC', 'MATIC', FALSE, '#8247E5', 4),
('sepolia', 'Sepolia Testnet', 11155111, 'https://eth-sepolia.g.alchemy.com/v2/', 'https://rpc2.sepolia.org', 'https://sepolia.etherscan.io', 'ETH', 'Sepolia ETH', TRUE, '#A855F7', 100),
('base-sepolia', 'Base Sepolia', 84532, 'https://base-sepolia.g.alchemy.com/v2/', 'https://sepolia.base.org', 'https://sepolia.basescan.org', 'ETH', 'Sepolia ETH', TRUE, '#0052FF', 101);
