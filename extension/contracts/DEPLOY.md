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

### Deploy to Base Sepolia
```bash
npm run deploy:base-sepolia
```

Output will show:
```
AddressRegistry deployed to: 0x...
```

### Verify on Basescan (optional)
```bash
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS>
```

## After Deployment

1. Copy the deployed address from terminal output
2. Update `extension/src/constants/registry.ts`:
   ```ts
   export const REGISTRY_ADDRESS = '0x...your_new_address...';
   ```
3. Rebuild extension: `cd .. && npm run build`

## Check Contract

- Basescan: `https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>`
- Read contract state via Basescan "Read Contract" tab

## Get Test ETH

Base Sepolia faucet: https://www.alchemy.com/faucets/base-sepolia
