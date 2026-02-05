-- Create chain_type_configs table for cryptographic configuration
-- This stores BIP-44 coin types, curves, and derivation paths for each chain type

CREATE TABLE chain_type_configs (
    id VARCHAR(20) PRIMARY KEY,          -- 'evm', 'solana', 'sui', 'ton'
    name VARCHAR(50) NOT NULL,            -- Display name
    coin_type INT NOT NULL,               -- BIP-44 coin type (60 for ETH, 501 for SOL, etc.)
    curve VARCHAR(20) NOT NULL,           -- 'secp256k1' or 'ed25519'
    address_format VARCHAR(20) NOT NULL,  -- 'hex', 'base58', 'base64url'
    derivation_template VARCHAR(100) NOT NULL, -- Path template with {index} placeholder
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert the chain type configurations
INSERT INTO chain_type_configs (id, name, coin_type, curve, address_format, derivation_template, sort_order) VALUES
('evm', 'EVM', 60, 'secp256k1', 'hex', "m/44'/60'/0'/0/{index}", 1),
('solana', 'Solana', 501, 'ed25519', 'base58', "m/44'/501'/{index}'/0'", 2),
('sui', 'SUI', 784, 'ed25519', 'hex', "m/44'/784'/{index}'/0'/0'", 3),
('ton', 'TON', 607, 'ed25519', 'base64url', "m/44'/607'/{index}'", 4);
