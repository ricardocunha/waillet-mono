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

### Test
```bash
npm test
```

Run this before every deploy to catch regressions.

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

### Upgrade Safety Checklist

Before running an upgrade:

- [ ] New implementation passes all unit tests (`npm test`)
- [ ] No storage layout conflicts (only appended new variables at the end)
- [ ] Upgrade tested on Base Sepolia first
- [ ] Proxy address confirmed in `registry.ts`
- [ ] Team notified — proxy state is shared

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


## Monitoring After Deployment

After deploying or upgrading, verify the contract emits expected events using `cast`:

```bash
# Watch for AddressRegistered events on Base Sepolia
cast logs --address <PROXY_ADDRESS> \
  --sig "AddressRegistered(address indexed,string)" \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --from-block latest
```

Set up a webhook or alert (e.g. via Tenderly or Alchemy Notify) for `Upgraded` events to be notified of any unauthorized upgrades.

## Multi-Sig Deployment (Mainnet Recommendation)

For mainnet, transfer proxy ownership to a Gnosis Safe after initial deployment:

```bash
# After deploying, transfer ownership to Safe
cast send <PROXY_ADDRESS> "transferOwnership(address)" <SAFE_ADDRESS> \
  --private-key $PRIVATE_KEY \
  --rpc-url $BASE_MAINNET_RPC_URL
```

Upgrades then require multi-sig approval, preventing single-key compromise from changing the contract.

## Security Considerations

- **Never commit your `.env` file** — it contains `PRIVATE_KEY`
- Add `.env` to `.gitignore` if not already present
- Use a dedicated deployer wallet with only enough ETH for gas — never your main wallet
- After deployment, verify the proxy owner is the expected address:
  ```bash
  cast call <PROXY_ADDRESS> "owner()(address)" --rpc-url $BASE_SEPOLIA_RPC_URL
  ```

## Exporting the ABI

After compilation, the ABI is in `artifacts/contracts/AddressRegistry.sol/AddressRegistry.json`. To extract just the ABI for use in the frontend:

```bash
cat artifacts/contracts/AddressRegistry.sol/AddressRegistry.json | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['abi'], indent=2))" > abi.json
```

Copy `abi.json` to `extension/src/constants/` and import it where needed.

## Network Configuration

| Network | Chain ID | RPC Env Var | Explorer |
|---------|----------|-------------|----------|
| Base Sepolia | 84532 | `BASE_SEPOLIA_RPC_URL` | basescan.org/sepolia |
| Base Mainnet | 8453 | `BASE_MAINNET_RPC_URL` | basescan.org |
| Sepolia | 11155111 | `SEPOLIA_RPC_URL` | sepolia.etherscan.io |
| Ethereum | 1 | `MAINNET_RPC_URL` | etherscan.io |

## Gas Optimization

Before deploying, estimate gas to avoid surprises:

```bash
npx hardhat run scripts/deploy-registry.ts --network baseSepolia 2>&1 | grep "gas"
```

The UUPS proxy pattern is already gas-efficient for upgrades — only the implementation changes, the proxy storage stays.

## Hardhat Config

Network settings live in `hardhat.config.ts`. To add a new network:

```ts
networks: {
  myNetwork: {
    url: process.env.MY_NETWORK_RPC_URL,
    accounts: [process.env.PRIVATE_KEY!],
    chainId: 12345,
  },
},
```

Then deploy with `--network myNetwork`.

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
