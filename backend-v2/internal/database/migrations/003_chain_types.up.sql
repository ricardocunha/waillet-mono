-- Add chain_type column to networks table for multi-chain support
-- chain_type: 'evm', 'solana', 'sui', 'ton'

-- Step 1: Add chain_type column
ALTER TABLE networks ADD COLUMN chain_type VARCHAR(20) NOT NULL DEFAULT 'evm' AFTER slug;

-- Step 2: Make chain_id nullable for non-EVM chains (they don't use EVM chain IDs)
ALTER TABLE networks MODIFY COLUMN chain_id INT DEFAULT NULL;

-- Step 3: Drop the unique constraint on chain_id since non-EVM chains may have NULL or shared identifiers
ALTER TABLE networks DROP INDEX chain_id;

-- Step 4: Add a new index for chain_type
ALTER TABLE networks ADD INDEX idx_chain_type (chain_type);

-- Step 5: Add unique constraint on (chain_type, slug) to prevent duplicates
ALTER TABLE networks ADD UNIQUE INDEX idx_chain_type_slug (chain_type, slug);

-- Step 6: Insert Solana networks
-- CMC ID for SOL: 5426
INSERT INTO networks (slug, chain_type, name, chain_id, rpc_url, rpc_url_fallback, explorer_url, native_currency_symbol, native_currency_name, native_currency_decimals, is_testnet, display_color, icon_url, sort_order) VALUES
('solana-mainnet', 'solana', 'Solana Mainnet', NULL, 'https://api.mainnet-beta.solana.com', 'https://solana-mainnet.g.alchemy.com/v2/', 'https://solscan.io', 'SOL', 'Solana', 9, FALSE, '#9945FF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png', 40),
('solana-devnet', 'solana', 'Solana Devnet', NULL, 'https://api.devnet.solana.com', NULL, 'https://solscan.io?cluster=devnet', 'SOL', 'Solana', 9, TRUE, '#9945FF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png', 102),
('solana-testnet', 'solana', 'Solana Testnet', NULL, 'https://api.testnet.solana.com', NULL, 'https://solscan.io?cluster=testnet', 'SOL', 'Solana', 9, TRUE, '#9945FF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png', 103);

-- Step 7: Insert SUI networks
-- CMC ID for SUI: 20947
INSERT INTO networks (slug, chain_type, name, chain_id, rpc_url, rpc_url_fallback, explorer_url, native_currency_symbol, native_currency_name, native_currency_decimals, is_testnet, display_color, icon_url, sort_order) VALUES
('sui-mainnet', 'sui', 'SUI Mainnet', NULL, 'https://fullnode.mainnet.sui.io', 'https://sui-mainnet.public.blastapi.io', 'https://suiscan.xyz', 'SUI', 'SUI', 9, FALSE, '#4DA2FF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png', 41),
('sui-testnet', 'sui', 'SUI Testnet', NULL, 'https://fullnode.testnet.sui.io', NULL, 'https://suiscan.xyz/testnet', 'SUI', 'SUI', 9, TRUE, '#4DA2FF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png', 104),
('sui-devnet', 'sui', 'SUI Devnet', NULL, 'https://fullnode.devnet.sui.io', NULL, 'https://suiscan.xyz/devnet', 'SUI', 'SUI', 9, TRUE, '#4DA2FF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png', 105);

-- Step 8: Insert TON networks
-- CMC ID for TON: 11419
INSERT INTO networks (slug, chain_type, name, chain_id, rpc_url, rpc_url_fallback, explorer_url, native_currency_symbol, native_currency_name, native_currency_decimals, is_testnet, display_color, icon_url, sort_order) VALUES
('ton-mainnet', 'ton', 'TON Mainnet', NULL, 'https://toncenter.com/api/v2/jsonRPC', 'https://ton-mainnet.public.blastapi.io', 'https://tonscan.org', 'TON', 'Toncoin', 9, FALSE, '#0098EA', 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png', 42),
('ton-testnet', 'ton', 'TON Testnet', NULL, 'https://testnet.toncenter.com/api/v2/jsonRPC', NULL, 'https://testnet.tonscan.org', 'TON', 'Toncoin', 9, TRUE, '#0098EA', 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png', 106);
