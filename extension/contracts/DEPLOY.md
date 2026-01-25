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

> Note: verify the **implementation** address, not the proxy. The proxy itself is auto-verified by the UUPS plugin.

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

## Mainnet Deployment

> ⚠️ **Use a hardware wallet or multi-sig for mainnet deploys — never a hot key.**

The same commands work for mainnet. Replace `--network baseSepolia` with `--network base` and ensure your `.env` has:

```
MAINNET_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=<deployer key — use hardware wallet signer if possible>
```

Run a full audit and test suite before deploying to mainnet.

## Troubleshooting

**"Nonce too high" error on deploy:**
Reset your account nonce in MetaMask: Settings → Advanced → Reset Account.

**"Insufficient funds" on Hardhat deploy:**
Make sure the deployer wallet has enough Base Sepolia ETH. Use the faucet link above.

**Contract not appearing on Basescan after verify:**
Wait 1–2 minutes — Basescan indexing can be slow. If it still doesn't appear, double-check the implementation address (not the proxy).
