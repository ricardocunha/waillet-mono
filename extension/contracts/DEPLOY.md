# Contract Deployment Guide

## Setup

```bash
cd extension/contracts
npm install
cp .env.example .env
```

Edit `.env` and add your private key (without 0x prefix):
```
PRIVATE_KEY=your_private_key_here
```

## Commands

### Compile
```bash
npm run compile
```

### Deploy to Base Sepolia (UUPS Proxy)
```bash
npm run deploy:base-sepolia
```

Output will show:
```
Proxy (use this address): 0x...
Implementation: 0x...
```

The proxy address is what users and the frontend interact with. It never changes after initial deployment.

### Upgrade an Existing Deployment
```bash
PROXY_ADDRESS=0x...your_proxy_address... npx hardhat run scripts/upgrade-registry.ts --network baseSepolia
```

This deploys a new implementation and points the proxy to it. The proxy address stays the same, all state is preserved.

**Important:** When modifying `AddressRegistry.sol` for upgrades, never reorder or remove existing state variables — only append new ones at the end.

### Verify on Basescan (optional)
```bash
npx hardhat verify --network baseSepolia <IMPLEMENTATION_ADDRESS>
```

## After Deployment

1. Copy the **proxy** address from terminal output
2. Update `extension/src/constants/registry.ts`:
   ```ts
   address: '0x...your_proxy_address...',
   ```
3. Rebuild extension: `cd .. && npm run build`

After upgrades, no frontend changes are needed — the proxy address remains the same.

## Check Contract

- Basescan: `https://sepolia.basescan.org/address/<PROXY_ADDRESS>`
- Read contract state via Basescan "Read as Proxy" tab

## Get Test ETH

Base Sepolia faucet: https://www.alchemy.com/faucets/base-sepolia
