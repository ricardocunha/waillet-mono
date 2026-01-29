import { HDNodeWallet, Wallet, JsonRpcProvider, parseUnits, formatUnits, Contract } from 'ethers';

const BACKEND_RPC_PROXY = 'http://localhost:8000/api/rpc/proxy';

// Ethers error codes
enum EthersErrorCode {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  CALL_EXCEPTION = 'CALL_EXCEPTION',
  NONCE_EXPIRED = 'NONCE_EXPIRED',
  REPLACEMENT_UNDERPRICED = 'REPLACEMENT_UNDERPRICED',
  UNPREDICTABLE_GAS_LIMIT = 'UNPREDICTABLE_GAS_LIMIT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
}

class ProxiedJsonRpcProvider extends JsonRpcProvider {
  private chainName: string;

  constructor(chainName: string) {
    super(BACKEND_RPC_PROXY);
    this.chainName = chainName;
  }

  async _send(payload: any | Array<any>): Promise<Array<any>> {
    const payloads = Array.isArray(payload) ? payload : [payload];
    
    console.log(`🔄 RPC Call: ${this.chainName}`, payloads);

    try {
      // Convert ethers payload to our backend format
      const requests = payloads.map((p) => ({
        chain: this.chainName,
        method: p.method,
        params: p.params || [],
        id: p.id || 1,
        jsonrpc: p.jsonrpc || '2.0',
      }));

      const responses = await Promise.all(
        requests.map(async (request) => {
          const response = await fetch(BACKEND_RPC_PROXY, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend RPC proxy error: ${response.status} - ${errorText}`);
          }

          return response.json();
        })
      );

      console.log(`✅ RPC Results: ${this.chainName}`, responses);

      responses.forEach((result) => {
        if (result.error) {
          throw new Error(result.error.message || JSON.stringify(result.error));
        }
      });

      return responses;
    } catch (error) {
      console.error(`❌ RPC Error: ${this.chainName}`, error);
      throw error;
    }
  }
}

export interface WalletAccount {
  address: string;
  privateKey: string;
  index: number;
  name?: string; // Account label (e.g., "Account 1", "Trading")
  chain?: string; // Current chain (ethereum, sepolia, base, base-sepolia)
  imported?: boolean; // True if imported via private key (not derived from mnemonic)
}

export interface ChainConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  nativeCurrency: string;
  explorer: string;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  token?: string;
  chain: string;
  data?: string;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  explorerUrl: string;
}

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];


export const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    name: 'Ethereum',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    chainId: 1,
    nativeCurrency: 'ETH',
    explorer: 'https://etherscan.io',
  },
  bsc: {
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    chainId: 56,
    nativeCurrency: 'BNB',
    explorer: 'https://bscscan.com',
  },
  base: {
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    chainId: 8453,
    nativeCurrency: 'ETH',
    explorer: 'https://basescan.org',
  },
  sepolia: {
    name: 'Sepolia Testnet',
    rpcUrl: 'sepolia',
    chainId: 11155111,
    nativeCurrency: 'ETH',
    explorer: 'https://sepolia.etherscan.io',
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    chainId: 84532,
    nativeCurrency: 'ETH',
    explorer: 'https://sepolia.basescan.org',
  },
};

export const TOKENS: Record<string, Record<string, string>> = {
  USDT: {
    ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    bsc: '0x55d398326f99059fF775485246999027B3197955',
    sepolia: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    'base-sepolia': '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  },
  USDC: {
    ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
};

export class WalletService {
  static generateMnemonic(): string {
    const wallet = Wallet.createRandom();
    return wallet.mnemonic!.phrase;
  }

  static fromMnemonic(mnemonic: string, index: number = 0): WalletAccount {
    const path = `m/44'/60'/0'/0/${index}`;
    const hdNode = HDNodeWallet.fromPhrase(mnemonic, undefined, path);

    return {
      address: hdNode.address,
      privateKey: hdNode.privateKey,
      index,
      name: `Account ${index + 1}`
    };
  }

  static async getProvider(chain: string): Promise<JsonRpcProvider> {
    const chainName = chain.toLowerCase();
    const chainConfig = CHAINS[chainName];
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    if (chainConfig.rpcUrl.startsWith('http')) {
      return new JsonRpcProvider(chainConfig.rpcUrl);
    }

    return new ProxiedJsonRpcProvider(chainName);
  }

  static async sendTransaction(
    privateKey: string,
    to: string,
    value: string,
    data: string,
    chain: string
  ): Promise<string> {
    const provider = await this.getProvider(chain);
    const wallet = new Wallet(privateKey, provider);

    try {
      // Check if user has enough ETH for gas
      const balance = await provider.getBalance(wallet.address);
      if (balance === BigInt(0)) {
        throw new Error(`Insufficient ETH for gas on ${chain}. Your balance is 0 ETH.`);
      }

      console.log(`[WalletService] Sending transaction on ${chain}:`, { to, value, data: data?.slice(0, 20) });

      const tx = await wallet.sendTransaction({
        to,
        value: value === '0x0' || value === '0' ? 0 : value,
        data: data || '0x',
      });

      console.log(`[WalletService] Transaction sent:`, tx.hash);

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction failed');
      }

      console.log(`[WalletService] Transaction confirmed:`, tx.hash);
      return tx.hash;
    } catch (error: any) {
      console.error('[WalletService] Transaction error:', error);

      // Parse ethers errors to provide better messages
      switch (error.code) {
        case EthersErrorCode.INSUFFICIENT_FUNDS:
          throw new Error(`Insufficient ETH for gas on ${chain}. Please add ETH to your wallet.`);

        case EthersErrorCode.CALL_EXCEPTION:
          throw new Error(`Transaction would fail: ${error.reason || 'Contract execution reverted'}. You may not have enough ETH for gas.`);

        case EthersErrorCode.UNPREDICTABLE_GAS_LIMIT:
          throw new Error(`Cannot estimate gas. You may not have enough ETH for gas on ${chain}.`);

        case EthersErrorCode.NONCE_EXPIRED:
          throw new Error('Transaction nonce expired. Please try again.');

        case EthersErrorCode.REPLACEMENT_UNDERPRICED:
          throw new Error('Gas price too low. Please try again with higher gas.');

        case EthersErrorCode.NETWORK_ERROR:
          throw new Error('Network error. Please check your connection and try again.');

        case EthersErrorCode.TIMEOUT:
          throw new Error('Transaction timed out. Please try again.');

        default:
          // Re-throw with original message if we don't have a better one
          throw new Error(error.message || 'Transaction failed');
      }
    }
  }

  static async sendNativeToken(
    privateKey: string,
    to: string,
    amount: string,
    chain: string
  ): Promise<TransactionResult> {
    const provider = await this.getProvider(chain);
    const wallet = new Wallet(privateKey, provider);
    const chainConfig = CHAINS[chain.toLowerCase()];

    const value = parseUnits(amount, 18);

    const tx = await wallet.sendTransaction({
      to,
      value,
    });

    await tx.wait();

    return {
      hash: tx.hash,
      from: wallet.address,
      to,
      value: amount,
      explorerUrl: `${chainConfig.explorer}/tx/${tx.hash}`,
    };
  }

  static async sendToken(
    privateKey: string,
    to: string,
    amount: string,
    tokenSymbol: string,
    chain: string
  ): Promise<TransactionResult> {
    const provider = await this.getProvider(chain);
    const wallet = new Wallet(privateKey, provider);
    const chainConfig = CHAINS[chain.toLowerCase()];

    const tokenAddress = TOKENS[tokenSymbol.toUpperCase()]?.[chain.toLowerCase()];
    if (!tokenAddress) {
      throw new Error(`Token ${tokenSymbol} not supported on ${chain}`);
    }

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);

    const decimals = await tokenContract.decimals();
    const value = parseUnits(amount, decimals);

    const tx = await tokenContract.transfer(to, value);
    await tx.wait();

    return {
      hash: tx.hash,
      from: wallet.address,
      to,
      value: amount,
      explorerUrl: `${chainConfig.explorer}/tx/${tx.hash}`,
    };
  }

  static async getBalance(
    address: string,
    chain: string,
    tokenSymbol?: string
  ): Promise<string> {
    const provider = await this.getProvider(chain);

    if (!tokenSymbol) {
      const balance = await provider.getBalance(address);
      return formatUnits(balance, 18);
    }

    const tokenAddress = TOKENS[tokenSymbol.toUpperCase()]?.[chain.toLowerCase()];
    if (!tokenAddress) {
      throw new Error(`Token ${tokenSymbol} not supported on ${chain}`);
    }

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await tokenContract.decimals();
    const balance = await tokenContract.balanceOf(address);

    return formatUnits(balance, decimals);
  }

  static async estimateGas(
    privateKey: string,
    to: string,
    amount: string,
    chain: string,
    tokenSymbol?: string
  ): Promise<{ gasLimit: string; gasPrice: string; gasCost: string }> {
    const provider = await this.getProvider(chain);
    const wallet = new Wallet(privateKey, provider);

    let gasLimit: bigint;
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || parseUnits('20', 'gwei');

    if (!tokenSymbol) {
      const value = parseUnits(amount, 18);
      gasLimit = await provider.estimateGas({
        from: wallet.address,
        to,
        value,
      });
    } else {
      const tokenAddress = TOKENS[tokenSymbol.toUpperCase()]?.[chain.toLowerCase()];
      if (!tokenAddress) {
        throw new Error(`Token ${tokenSymbol} not supported on ${chain}`);
      }

      const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);
      const decimals = await tokenContract.decimals();
      const value = parseUnits(amount, decimals);

      gasLimit = await tokenContract.transfer.estimateGas(to, value);
    }

    const gasCost = gasLimit * gasPrice;

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: formatUnits(gasPrice, 'gwei'),
      gasCost: formatUnits(gasCost, 18),
    };
  }

  static async signMessage(privateKey: string, message: string): Promise<string> {
    const wallet = new Wallet(privateKey);

    // If message starts with 0x, it's hex-encoded
    if (message.startsWith('0x')) {
      const bytes = message.slice(2);
      const messageBytes = new Uint8Array(bytes.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      return await wallet.signMessage(messageBytes);
    }

    return await wallet.signMessage(message);
  }

  static async signTypedData(
    privateKey: string,
    domain: any,
    types: any,
    value: any
  ): Promise<string> {
    const wallet = new Wallet(privateKey);

    // Remove EIP712Domain from types if present (ethers adds it automatically)
    const cleanTypes = { ...types };
    delete cleanTypes.EIP712Domain;

    return await wallet.signTypedData(domain, cleanTypes, value);
  }
}


