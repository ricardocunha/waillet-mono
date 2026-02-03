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

-- Insert default networks with icon URLs from CoinMarketCap
-- Icon URL format: https://s2.coinmarketcap.com/static/img/coins/64x64/{cmc_id}.png
-- CMC IDs for native/governance tokens:
-- L1: ETH=1027, BNB=1839, POL=3890, AVAX=5805, FTM=3513, CRO=3635, GNO=1659, CELO=5567, GLMR=6836, KAVA=4846, ONE=3945
-- L2 Optimistic: ARB=11841, OP=11840, BASE=27716, MNT=27075, METIS=9640, BLAST=28480, MODE=30915
-- L2 ZK: ZK=24091, SCR=26998, MANTA=13631

INSERT INTO networks (slug, name, chain_id, rpc_url, rpc_url_fallback, explorer_url, native_currency_symbol, native_currency_name, is_testnet, display_color, icon_url, sort_order) VALUES
-- Major L1 Networks
('ethereum', 'Ethereum', 1, 'https://eth-mainnet.g.alchemy.com/v2/', 'https://eth.llamarpc.com', 'https://etherscan.io', 'ETH', 'Ether', FALSE, '#627EEA', 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png', 1),
('bsc', 'BNB Smart Chain', 56, 'https://bsc-dataseed1.binance.org', 'https://bsc-dataseed.binance.org', 'https://bscscan.com', 'BNB', 'BNB', FALSE, '#F0B90B', 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png', 2),
('polygon', 'Polygon', 137, 'https://polygon-mainnet.g.alchemy.com/v2/', 'https://polygon-rpc.com', 'https://polygonscan.com', 'POL', 'POL', FALSE, '#8247E5', 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png', 3),
('avalanche', 'Avalanche C-Chain', 43114, 'https://api.avax.network/ext/bc/C/rpc', 'https://avalanche-c-chain.publicnode.com', 'https://snowtrace.io', 'AVAX', 'Avalanche', FALSE, '#E84142', 'https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png', 4),
('fantom', 'Fantom Opera', 250, 'https://rpc.ftm.tools', 'https://fantom-rpc.publicnode.com', 'https://ftmscan.com', 'FTM', 'Fantom', FALSE, '#1969FF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/3513.png', 5),
('cronos', 'Cronos', 25, 'https://evm.cronos.org', 'https://cronos-rpc.publicnode.com', 'https://cronoscan.com', 'CRO', 'Cronos', FALSE, '#002D74', 'https://s2.coinmarketcap.com/static/img/coins/64x64/3635.png', 6),
('gnosis', 'Gnosis Chain', 100, 'https://rpc.gnosischain.com', 'https://gnosis-rpc.publicnode.com', 'https://gnosisscan.io', 'xDAI', 'xDAI', FALSE, '#04795B', 'https://s2.coinmarketcap.com/static/img/coins/64x64/1659.png', 7),
('celo', 'Celo', 42220, 'https://forno.celo.org', 'https://celo-rpc.publicnode.com', 'https://celoscan.io', 'CELO', 'Celo', FALSE, '#35D07F', 'https://s2.coinmarketcap.com/static/img/coins/64x64/5567.png', 8),
('moonbeam', 'Moonbeam', 1284, 'https://rpc.api.moonbeam.network', 'https://moonbeam-rpc.publicnode.com', 'https://moonscan.io', 'GLMR', 'Glimmer', FALSE, '#53CBC9', 'https://s2.coinmarketcap.com/static/img/coins/64x64/6836.png', 9),
('kava', 'Kava EVM', 2222, 'https://evm.kava.io', 'https://kava-rpc.publicnode.com', 'https://kavascan.com', 'KAVA', 'Kava', FALSE, '#FF433E', 'https://s2.coinmarketcap.com/static/img/coins/64x64/4846.png', 10),
('harmony', 'Harmony', 1666600000, 'https://api.harmony.one', 'https://harmony-rpc.publicnode.com', 'https://explorer.harmony.one', 'ONE', 'ONE', FALSE, '#00AEE9', 'https://s2.coinmarketcap.com/static/img/coins/64x64/3945.png', 11),

-- L2 Networks (Optimistic Rollups) - use governance token icons
('arbitrum', 'Arbitrum One', 42161, 'https://arb-mainnet.g.alchemy.com/v2/', 'https://arb1.arbitrum.io/rpc', 'https://arbiscan.io', 'ETH', 'Ether', FALSE, '#28A0F0', 'https://s2.coinmarketcap.com/static/img/coins/64x64/11841.png', 20),
('optimism', 'Optimism', 10, 'https://opt-mainnet.g.alchemy.com/v2/', 'https://mainnet.optimism.io', 'https://optimistic.etherscan.io', 'ETH', 'Ether', FALSE, '#FF0420', 'https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png', 21),
('base', 'Base', 8453, 'https://base-mainnet.g.alchemy.com/v2/', 'https://mainnet.base.org', 'https://basescan.org', 'ETH', 'Ether', FALSE, '#0052FF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/27716.png', 22),
('mantle', 'Mantle', 5000, 'https://rpc.mantle.xyz', 'https://mantle-rpc.publicnode.com', 'https://mantlescan.xyz', 'MNT', 'Mantle', FALSE, '#000000', 'https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png', 23),
('metis', 'Metis Andromeda', 1088, 'https://andromeda.metis.io/?owner=1088', 'https://metis-pokt.nodies.app', 'https://andromeda-explorer.metis.io', 'METIS', 'Metis', FALSE, '#00DACC', 'https://s2.coinmarketcap.com/static/img/coins/64x64/9640.png', 24),
('blast', 'Blast', 81457, 'https://rpc.blast.io', 'https://blast-rpc.publicnode.com', 'https://blastscan.io', 'ETH', 'Ether', FALSE, '#FCFC03', 'https://s2.coinmarketcap.com/static/img/coins/64x64/28480.png', 25),
('mode', 'Mode', 34443, 'https://mainnet.mode.network', 'https://mode-rpc.publicnode.com', 'https://modescan.io', 'ETH', 'Ether', FALSE, '#DFFE00', 'https://s2.coinmarketcap.com/static/img/coins/64x64/30915.png', 26),

-- L2 Networks (ZK Rollups) - use governance token icons where available
('zksync', 'zkSync Era', 324, 'https://mainnet.era.zksync.io', 'https://zksync-era-rpc.publicnode.com', 'https://explorer.zksync.io', 'ETH', 'Ether', FALSE, '#8C8DFC', 'https://s2.coinmarketcap.com/static/img/coins/64x64/24091.png', 30),
('linea', 'Linea', 59144, 'https://linea-mainnet.g.alchemy.com/v2/', 'https://rpc.linea.build', 'https://lineascan.build', 'ETH', 'Ether', FALSE, '#61DFFF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png', 31),
('polygon-zkevm', 'Polygon zkEVM', 1101, 'https://polygonzkevm-mainnet.g.alchemy.com/v2/', 'https://zkevm-rpc.com', 'https://zkevm.polygonscan.com', 'ETH', 'Ether', FALSE, '#8247E5', 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png', 32),
('scroll', 'Scroll', 534352, 'https://rpc.scroll.io', 'https://scroll-rpc.publicnode.com', 'https://scrollscan.com', 'ETH', 'Ether', FALSE, '#FFEEDA', 'https://s2.coinmarketcap.com/static/img/coins/64x64/26998.png', 33),
('manta', 'Manta Pacific', 169, 'https://pacific-rpc.manta.network/http', 'https://manta-pacific-rpc.publicnode.com', 'https://pacific-explorer.manta.network', 'ETH', 'Ether', FALSE, '#0091FF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/13631.png', 34),

-- Testnets
('sepolia', 'Sepolia Testnet', 11155111, 'https://eth-sepolia.g.alchemy.com/v2/', 'https://rpc2.sepolia.org', 'https://sepolia.etherscan.io', 'ETH', 'Sepolia ETH', TRUE, '#A855F7', 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png', 100),
('base-sepolia', 'Base Sepolia', 84532, 'https://base-sepolia.g.alchemy.com/v2/', 'https://sepolia.base.org', 'https://sepolia.basescan.org', 'ETH', 'Sepolia ETH', TRUE, '#0052FF', 'https://s2.coinmarketcap.com/static/img/coins/64x64/27716.png', 101);
