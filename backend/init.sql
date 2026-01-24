-- Waillet Database Schema

-- Favorites table: stores user shortcuts for AI agent
CREATE TABLE IF NOT EXISTS favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    alias VARCHAR(100) NOT NULL,
    address VARCHAR(42) NOT NULL,
    chain VARCHAR(50) DEFAULT NULL,
    asset VARCHAR(50) DEFAULT NULL,
    type ENUM('address', 'contract', 'token') DEFAULT 'address',
    value VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wallet_address (wallet_address),
    UNIQUE KEY unique_wallet_alias (wallet_address, alias)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Security policies table: allowlists and spending limits
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

-- Risk logs table: transaction analysis history
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

-- Insert sample favorites for testing
INSERT INTO favorites (wallet_address, alias, address, chain, asset, type) VALUES
('0x0000000000000000000000000000000000000000', 'binance', '0x28C6c06298d514Db089934071355E5743bf21d60', 'bsc', 'BNB', 'address'),
('0x0000000000000000000000000000000000000000', 'usdc-polygon', '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', 'polygon', 'USDC', 'token');


