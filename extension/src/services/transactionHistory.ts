/**
 * Transaction history service using Etherscan V2 API
 * Supports all EVM chains via chainid parameter
 */

export interface TransactionHistoryItem {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: Date;
  localTime: string;
  gasUsed: string;
  gasPrice: string;
  gasCost: string;
  nativeCurrency: string;
  isIncoming: boolean;
  isFailed: boolean;
  explorerUrl: string;
  method: string;
}

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  gasUsed: string;
  gasPrice: string;
  isError: string;
  functionName: string;
  methodId: string;
}

const API_BASE_URL = 'https://api.etherscan.io/v2/api';

function extractMethodName(functionName: string, methodId: string): string {
  if (functionName) {
    const match = functionName.match(/^(\w+)\(/);
    if (match) return match[1];
    return functionName;
  }
  if (methodId === '0x') return 'Transfer';
  return methodId.slice(0, 10);
}

export async function fetchEVMTransactionHistory(
  address: string,
  chainId: number,
  explorerBaseUrl: string,
  nativeSymbol: string,
  limit: number = 20
): Promise<TransactionHistoryItem[]> {
  const apiKey = import.meta.env.VITE_ETHERSCAN_API_KEY || '';

  const params = new URLSearchParams({
    chainid: chainId.toString(),
    module: 'account',
    action: 'txlist',
    address,
    startblock: '0',
    endblock: '99999999',
    page: '1',
    offset: limit.toString(),
    sort: 'desc',
  });

  if (apiKey) {
    params.set('apikey', apiKey);
  }

  const response = await fetch(`${API_BASE_URL}?${params.toString()}`);
  const data = await response.json();

  if (data.status !== '1' || !Array.isArray(data.result)) {
    return [];
  }

  const lowerAddress = address.toLowerCase();

  return data.result.map((tx: EtherscanTx): TransactionHistoryItem => {
    const timestamp = new Date(parseInt(tx.timeStamp) * 1000);
    const gasUsedBig = BigInt(tx.gasUsed || '0');
    const gasPriceBig = BigInt(tx.gasPrice || '0');
    const gasCostWei = gasUsedBig * gasPriceBig;
    const valueBig = BigInt(tx.value || '0');

    // Explorer URL: strip trailing slash
    const baseUrl = explorerBaseUrl.replace(/\/+$/, '');

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: formatWei(valueBig),
      timestamp,
      localTime: timestamp.toLocaleString(),
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      gasCost: formatWei(gasCostWei),
      nativeCurrency: nativeSymbol,
      isIncoming: tx.to.toLowerCase() === lowerAddress,
      isFailed: tx.isError === '1',
      explorerUrl: `${baseUrl}/tx/${tx.hash}`,
      method: extractMethodName(tx.functionName, tx.methodId),
    };
  });
}

function formatWei(wei: bigint): string {
  const whole = wei / BigInt(1e18);
  const remainder = wei % BigInt(1e18);
  const decimals = remainder.toString().padStart(18, '0').slice(0, 6);
  // Trim trailing zeros but keep at least 4 digits
  const trimmed = decimals.replace(/0+$/, '').padEnd(4, '0');
  return `${whole}.${trimmed}`;
}
