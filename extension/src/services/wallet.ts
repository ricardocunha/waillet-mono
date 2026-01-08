import { HDNodeWallet, Wallet, JsonRpcProvider, parseUnits, formatUnits, Contract } from 'ethers';

const BACKEND_RPC_PROXY = 'http://localhost:8000/api/rpc/proxy';

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
  sepolia: {
    name: 'Sepolia Testnet',
    rpcUrl: 'sepolia',
    chainId: 11155111,
    nativeCurrency: 'ETH',
    explorer: 'https://sepolia.etherscan.io',
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    rpcUrl: 'base-sepolia',
    chainId: 84532,
    nativeCurrency: 'ETH',
    explorer: 'https://sepolia.basescan.org',
  },

  ethereum: {
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    chainId: 1,
    nativeCurrency: 'ETH',
    explorer: 'https://etherscan.io',
  },
  polygon: {
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137,
    nativeCurrency: 'MATIC',
    explorer: 'https://polygonscan.com',
  },
  bsc: {
    name: 'BSC',
    rpcUrl: 'https://bsc-dataseed.binance.org',
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
};

export const TOKENS: Record<string, Record<string, string>> = {
  USDC: {
    ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  USDT: {
    ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    bsc: '0x55d398326f99059fF775485246999027B3197955',
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
      index
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


