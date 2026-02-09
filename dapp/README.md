# wAIllet DApp

A decentralized application for the wAIllet ecosystem.

## Features

- Connect wallet (MetaMask, wAIllet, WalletConnect)
- Bridge tokens between supported networks
- View token balances across chains
- Transaction history per network

## Status

**Under Construction**

This project is being built incrementally. Check back for updates!

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- ethers.js v6

## Supported Networks

### Mainnet
- Ethereum (chain ID: 1)
- Base (chain ID: 8453)
- BNB Smart Chain (chain ID: 56)

### Testnet
- Sepolia (chain ID: 11155111)
- Base Sepolia (chain ID: 84532)

## Bridge Pairs

| Source | Target |
|--------|--------|
| Ethereum | Base |
| Base | Ethereum |
| Sepolia | Base Sepolia |
| Base Sepolia | Sepolia |

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Type check
npm run typecheck
```

## Environment Variables

```env
VITE_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
VITE_BASE_RPC_URL=https://mainnet.base.org
```

## License

MIT
