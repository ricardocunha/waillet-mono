import { BackgroundMessageType, EthMethod, PendingRequestType, WindowMessageType } from './types/messaging';

console.log('Waillet background loaded');

// Pending dApp requests queue
interface PendingRequest {
  id: number;
  method: string;
  params: any[];
  origin: string;
  timestamp: number;
  tabId: number;
  messageId: number; // Original message ID from inpage script
}

const pendingRequests = new Map<number, PendingRequest>();
let requestCounter = 0;

// Read-only methods that don't require user approval
const READ_ONLY_METHODS = [
  EthMethod.BLOCK_NUMBER,
  EthMethod.CALL,
  EthMethod.CHAIN_ID,
  EthMethod.ESTIMATE_GAS,
  EthMethod.GAS_PRICE,
  EthMethod.GET_BALANCE,
  EthMethod.GET_BLOCK_BY_HASH,
  EthMethod.GET_BLOCK_BY_NUMBER,
  EthMethod.GET_CODE,
  EthMethod.GET_STORAGE_AT,
  EthMethod.GET_TRANSACTION_BY_HASH,
  EthMethod.GET_TRANSACTION_COUNT,
  EthMethod.GET_TRANSACTION_RECEIPT,
  EthMethod.NET_VERSION,
  EthMethod.WEB3_CLIENT_VERSION
];

chrome.runtime.onInstalled.addListener(() => {
  console.log('Waillet installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Existing RPC_REQUEST handler
  if (request.type === BackgroundMessageType.RPC_REQUEST) {
    console.log('🔄 Background RPC Request to:', request.url);
    console.log('📤 Request body:', request.body);
    console.log('📤 Request body type:', typeof request.body);
    console.log('📤 Request body length:', request.body?.length);

    fetch(request.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: request.body,
    })
      .then(async response => {
        console.log('📡 Response status:', response.status, response.statusText);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Background RPC HTTP Error:', response.status, response.statusText, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        const text = await response.text();
        console.log('📝 Response text:', text.substring(0, 200));
        
        if (!text || text.trim().length === 0) {
          throw new Error('Empty response from RPC endpoint');
        }
        
        try {
          const data = JSON.parse(text);
          console.log('✅ Parsed data:', data);
          sendResponse({ success: true, data });
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError, 'Text:', text);
          throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
        }
      })
      .catch(error => {
        console.error('❌ Background RPC Error:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  // NEW: dApp request handler
  if (request.type === BackgroundMessageType.DAPP_REQUEST) {
    handleDAppRequest(request, sender);
    // Return false since we'll respond via chrome.tabs.sendMessage later
    return false;
  }

  // NEW: User decision handler
  if (request.type === BackgroundMessageType.USER_DECISION) {
    handleUserDecision(request, sendResponse);
    return true;
  }

  // NEW: Content script ready notification
  if (request.type === BackgroundMessageType.CONTENT_SCRIPT_READY) {
    console.log('[Waillet] Content script ready for:', request.origin);
    sendResponse({ success: true });
    return false;
  }
});

/**
 * Handle dApp request from content script
 */
async function handleDAppRequest(request: any, sender: any) {
  const { method, params, origin, id } = request;
  const tabId = sender.tab?.id;

  if (!tabId) {
    console.error('[Waillet] No tab ID in request');
    return;
  }

  console.log(`[Waillet] dApp request: ${method} from ${origin}`, { params });

  // Handle read-only methods directly (no approval needed)
  if (READ_ONLY_METHODS.includes(method)) {
    console.log(`[Waillet] ✅ Handling read-only method: ${method}`, params);
    await executeRPCCall(method, params, tabId, id);
    return;
  }

  // Methods requiring user approval
  if (method === EthMethod.REQUEST_ACCOUNTS) {
    console.log(`[Waillet] 🔐 Handling account request from ${origin}`);
    await handleAccountsRequest(origin, tabId, id);
    return;
  }

  if (method === EthMethod.SEND_TRANSACTION) {
    console.log(`[Waillet] 💰 Handling send transaction from ${origin}`);
    await handleSendTransaction(params[0], origin, tabId, id);
    return;
  }

  // Signature methods
  if (method === EthMethod.PERSONAL_SIGN) {
    console.log(`[Waillet] Personal Sign ${origin}`);
    await handlePersonalSign(params, origin, tabId, id);
    return;
  }

  if (method === EthMethod.SIGN_TYPED_DATA_V4) {
    console.log(`[Waillet] Personal Sign typed ${origin}`);
    await handleSignTypedDataV4(params, origin, tabId, id);
    return;
  }

  if (method === EthMethod.SIGN) {
    console.log(`[Waillet] Sign ${origin}`);
    await handleEthSign(params, origin, tabId, id);
    return;
  }

  // Wallet methods
  if (method === EthMethod.WALLET_SWITCH_ETHEREUM_CHAIN) {
    console.log(`[Waillet] switch ethereum chain ${origin}`);
    await handleSwitchChain(params[0], origin, tabId, id);
    return;
  }

  if (method === EthMethod.WALLET_ADD_ETHEREUM_CHAIN) {
    console.log(`[Waillet] add ethereum chai ${origin}`);
    await handleAddChain(params[0], origin, tabId, id);
    return;
  }

  // EIP-2255: wallet_requestPermissions
  if (method === 'wallet_requestPermissions') {
    // Check if already connected
    const result = await chrome.storage.local.get('connectedSites');
    const connectedSites = result.connectedSites || {};

    if (connectedSites[origin]) {
      // Already connected, return permission grant
      await sendResponseToTab(tabId, id, [
        {
          parentCapability: 'eth_accounts',
          date: Date.now()
        }
      ], null);
    } else {
      // Not connected, trigger connection approval
      await handleAccountsRequest(origin, tabId, id);
    }
    return;
  }

  // EIP-5792: wallet_getCapabilities (experimental)
  if (method === 'wallet_getCapabilities') {
    // Return empty capabilities for now
    await sendResponseToTab(tabId, id, {}, null);
    return;
  }

  // Unsupported method
  console.warn(`[Waillet] ⚠️  Unsupported method: ${method}`, { params, origin });
  await sendResponseToTab(tabId, id, null, {
    code: 4200,
    message: `Method ${method} not supported`
  });
}

/**
 * Execute RPC call for read-only methods
 */
async function executeRPCCall(method: string, params: any[], tabId: number, messageId: number) {
  try {
    // Get current chain from storage (default to sepolia for testing)
    const storage = await chrome.storage.local.get('account');
    const chain = storage.account?.chain || 'sepolia';

    console.log(`[Waillet] Executing RPC call: ${method} on chain: ${chain}`, { params });

    let result;

    // Optimize: Return chainId directly from storage without RPC call
    if (method === EthMethod.CHAIN_ID) {
      const chainId = getChainIdHex(chain);
      console.log(`[Waillet] Returning cached chainId: ${chainId}`);
      result = chainId;
    } else {
      // Use existing RPC proxy for other methods
      const rpcBody = {
        chain,
        jsonrpc: '2.0',
        method,
        params,
        id: 1
      };

      console.log(`[Waillet] 📡 Sending to RPC proxy:`, rpcBody);

      const response = await fetch('http://localhost:8000/api/rpc/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcBody)
      });

      if (!response.ok) {
        throw new Error(`RPC proxy HTTP error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Waillet] 📥 RPC response for ${method}:`, data);

      if (data.error) {
        console.error(`[Waillet] ❌ RPC error for ${method}:`, data.error);
        await sendResponseToTab(tabId, messageId, null, data.error);
        return;
      }

      console.log(`[Waillet] ✅ RPC success for ${method}, result:`, data.result);
      result = data.result;
    }

    await sendResponseToTab(tabId, messageId, result, null);
  } catch (error: any) {
    console.error('[Waillet] RPC call error:', error);
    await sendResponseToTab(tabId, messageId, null, {
      code: 4900,
      message: error.message
    });
  }
}

/**
 * Send response back to content script via chrome.tabs.sendMessage
 */
const sentResponses = new Set<string>();
async function sendResponseToTab(tabId: number, messageId: number, result: any, error: any) {
  // Prevent duplicate responses
  const responseKey = `${tabId}-${messageId}`;
  if (sentResponses.has(responseKey)) {
    console.warn(`[Waillet] ⚠️ Attempted to send duplicate response for tab ${tabId}, message ${messageId}`);
    return;
  }
  sentResponses.add(responseKey);

  // Clean up old responses after 30 seconds
  setTimeout(() => sentResponses.delete(responseKey), 30000);

  try {
    console.log(`[Waillet] 📤 Sending response to tab ${tabId}, message ${messageId}`);
    await chrome.tabs.sendMessage(tabId, {
      type: WindowMessageType.WAILLET_RESPONSE,
      id: messageId,
      result,
      error
    });
  } catch (err) {
    console.error('[Waillet] Failed to send response to tab:', err);
  }
}

/**
 * Handle eth_requestAccounts (wallet connection)
 */
async function handleAccountsRequest(origin: string, tabId: number, messageId: number) {
  // Check if already connected
  const result = await chrome.storage.local.get('connectedSites');
  const connectedSites = result.connectedSites || {};

  if (connectedSites[origin]) {
    // Already connected, return account
    const accountResult = await chrome.storage.local.get('account');
    if (accountResult.account?.address) {
      console.log(`[Waillet] Already connected to ${origin}`);
      await sendResponseToTab(tabId, messageId, [accountResult.account.address], null);
      return;
    }
  }

  // Request user approval
  const internalId = ++requestCounter;
  pendingRequests.set(internalId, {
    id: internalId,
    method: EthMethod.REQUEST_ACCOUNTS,
    params: [],
    origin,
    timestamp: Date.now(),
    tabId,
    messageId
  });

  // Store pending request for popup to retrieve
  await chrome.storage.local.set({
    pendingRequest: {
      id: internalId,
      type: PendingRequestType.CONNECT,
      origin,
      tabId,
      timestamp: Date.now()
    }
  });

  console.log(`[Waillet] Connection request from ${origin} (ID: ${internalId})`);

  // Open extension popup for approval
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL('index.html'),
      type: 'popup',
      width: 506,
      height: 600,
      focused: true
    });
    console.log(`[Waillet] ✅ Popup window created for connection`);
  } catch (error) {
    console.error(`[Waillet] ❌ Failed to open popup:`, error);
  }

  // Note: Response will be sent via handleUserDecision
  // Don't call sendResponse here - keep the channel open
}

/**
 * Handle eth_sendTransaction
 */
async function handleSendTransaction(txParams: any, origin: string, tabId: number, messageId: number) {
  console.log(`[Waillet] 💸 Transaction request from ${origin}`, { txParams });

  const internalId = ++requestCounter;

  // Store pending transaction
  pendingRequests.set(internalId, {
    id: internalId,
    method: EthMethod.SEND_TRANSACTION,
    params: [txParams],
    origin,
    timestamp: Date.now(),
    tabId,
    messageId
  });

  console.log(`[Waillet] 🚀 Opening popup for transaction approval (ID: ${internalId})`);

  // Store the pending request first
  await chrome.storage.local.set({
    pendingRequest: {
      id: internalId,
      type: PendingRequestType.TRANSACTION,
      txParams,
      origin,
      tabId,
      timestamp: Date.now()
    }
  });

  console.log(`[Waillet] ✅ Stored pending transaction request (ID: ${internalId})`);

  // Open extension popup in a new window (openPopup doesn't work programmatically in MV3)
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL('index.html'),
      type: 'popup',
      width: 506,
      height: 600,
      focused: true
    });
    console.log(`[Waillet] ✅ Popup window created`);
  } catch (error) {
    console.error(`[Waillet] ❌ Failed to open popup:`, error);
  }

  // Response sent after user decision
  // Don't call sendResponse here - keep the channel open
}

/**
 * Handle personal_sign
 */
async function handlePersonalSign(params: any[], origin: string, tabId: number, messageId: number) {
  const internalId = ++requestCounter;
  const [message, address] = params;

  pendingRequests.set(internalId, {
    id: internalId,
    method: EthMethod.PERSONAL_SIGN,
    params,
    origin,
    timestamp: Date.now(),
    tabId,
    messageId
  });

  await chrome.storage.local.set({
    pendingRequest: {
      id: internalId,
      type: PendingRequestType.SIGN_MESSAGE,
      message,
      address,
      method: EthMethod.PERSONAL_SIGN,
      origin,
      tabId,
      timestamp: Date.now()
    }
  });

  console.log(`[Waillet] personal_sign request from ${origin} (ID: ${internalId})`);

  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL('index.html'),
      type: 'popup',
      width: 506,
      height: 600,
      focused: true
    });
  } catch (error) {
    console.error(`[Waillet] ❌ Failed to open popup:`, error);
  }
}

/**
 * Handle eth_signTypedData_v4
 */
async function handleSignTypedDataV4(params: any[], origin: string, tabId: number, messageId: number) {
  const internalId = ++requestCounter;
  const [address, typedData] = params;

  let parsedData;
  try {
    parsedData = typeof typedData === 'string' ? JSON.parse(typedData) : typedData;
  } catch (e) {
    await sendResponseToTab(tabId, messageId, null, {
      code: 4100,
      message: 'Invalid typed data format'
    });
    return;
  }

  pendingRequests.set(internalId, {
    id: internalId,
    method: EthMethod.SIGN_TYPED_DATA_V4,
    params,
    origin,
    timestamp: Date.now(),
    tabId,
    messageId
  });

  await chrome.storage.local.set({
    pendingRequest: {
      id: internalId,
      type: PendingRequestType.SIGN_TYPED_DATA,
      address,
      typedData: parsedData,
      method: EthMethod.SIGN_TYPED_DATA_V4,
      origin,
      tabId,
      timestamp: Date.now()
    }
  });

  console.log(`[Waillet] signTypedData_v4 request from ${origin} (ID: ${internalId})`);

  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL('index.html'),
      type: 'popup',
      width: 506,
      height: 600,
      focused: true
    });
  } catch (error) {
    console.error(`[Waillet] ❌ Failed to open popup:`, error);
  }
}

/**
 * Handle eth_sign (dangerous, warn user)
 */
async function handleEthSign(params: any[], origin: string, tabId: number, messageId: number) {
  const internalId = ++requestCounter;
  const [address, message] = params;

  pendingRequests.set(internalId, {
    id: internalId,
    method: EthMethod.SIGN,
    params,
    origin,
    timestamp: Date.now(),
    tabId,
    messageId
  });

  await chrome.storage.local.set({
    pendingRequest: {
      id: internalId,
      type: PendingRequestType.SIGN_MESSAGE,
      message,
      address,
      method: EthMethod.SIGN,
      origin,
      tabId,
      timestamp: Date.now(),
      dangerous: true // Flag this as dangerous
    }
  });

  console.log(`[Waillet] eth_sign request from ${origin} (ID: ${internalId}) - DANGEROUS`);

  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL('index.html'),
      type: 'popup',
      width: 506,
      height: 600,
      focused: true
    });
  } catch (error) {
    console.error(`[Waillet] ❌ Failed to open popup:`, error);
  }
}

/**
 * Handle wallet_switchEthereumChain
 */
async function handleSwitchChain(params: any, origin: string, tabId: number, messageId: number) {
  const chainId = params?.chainId;

  if (!chainId || typeof chainId !== 'string') {
    await sendResponseToTab(tabId, messageId, null, {
      code: 4100,
      message: 'Invalid chainId parameter'
    });
    return;
  }

  // Convert hex chainId to decimal
  const chainIdDecimal = parseInt(chainId, 16);

  // Map known chain IDs to chain names
  const chainMap: Record<number, string> = {
    1: 'ethereum',
    11155111: 'sepolia',
    84532: 'base-sepolia',
    137: 'polygon',
    56: 'bsc',
    8453: 'base'
  };

  const chainName = chainMap[chainIdDecimal];

  if (!chainName) {
    await sendResponseToTab(tabId, messageId, null, {
      code: 4902,
      message: `Unrecognized chain ID: ${chainId}. Try adding the chain first with wallet_addEthereumChain.`
    });
    return;
  }

  // Check if already on this chain
  const storage = await chrome.storage.local.get('account');
  const currentChain = storage.account?.chain;

  console.log(`[Waillet] 🔄 Switch chain request: ${currentChain} → ${chainName} (${chainId}) from ${origin}`);

  if (currentChain === chainName) {
    console.log(`[Waillet] ℹ️  Already on chain ${chainName}, returning success without popup`);
    await sendResponseToTab(tabId, messageId, null, null);
    return;
  }

  const internalId = ++requestCounter;

  pendingRequests.set(internalId, {
    id: internalId,
    method: EthMethod.WALLET_SWITCH_ETHEREUM_CHAIN,
    params: [params],
    origin,
    timestamp: Date.now(),
    tabId,
    messageId
  });

  console.log(`[Waillet] 🚀 Opening popup for chain switch approval (ID: ${internalId})`);

  // Store the pending request first
  await chrome.storage.local.set({
    pendingRequest: {
      id: internalId,
      type: PendingRequestType.SWITCH_NETWORK,
      chainId,
      chainIdDecimal,
      chainName,
      origin,
      tabId,
      timestamp: Date.now()
    }
  });

  console.log(`[Waillet] ✅ Stored pending network switch request to ${chainName}`);

  // Open extension popup in a new window
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL('index.html'),
      type: 'popup',
      width: 506,
      height: 600,
      focused: true
    });
    console.log(`[Waillet] ✅ Popup window created for chain switch`);
  } catch (error) {
    console.error(`[Waillet] ❌ Failed to open popup:`, error);
  }
}

/**
 * Handle wallet_addEthereumChain
 */
async function handleAddChain(_params: any, _origin: string, tabId: number, messageId: number) {
  // For now, reject adding custom chains (future feature)
  await sendResponseToTab(tabId, messageId, null, {
    code: 4902,
    message: 'Adding custom chains is not yet supported. Supported chains: Ethereum, Sepolia, Base, Polygon, BSC'
  });
}

/**
 * Handle user decision from extension UI
 */
async function handleUserDecision(request: any, sendResponse: Function) {
  const { requestId, approved, result, error } = request;

  const pending = pendingRequests.get(requestId);
  if (!pending) {
    sendResponse({ error: 'Request not found or expired' });
    return;
  }

  // Send response back to the tab via chrome.tabs.sendMessage
  if (approved) {
    await sendResponseToTab(pending.tabId, pending.messageId, result, null);
  } else {
    await sendResponseToTab(pending.tabId, pending.messageId, null, error || { code: 4001, message: 'User rejected request' });
  }

  // If this was a network switch approval, emit chainChanged event
  if (approved && pending.method === EthMethod.WALLET_SWITCH_ETHEREUM_CHAIN) {
    const storage = await chrome.storage.local.get('account');
    if (storage.account?.chain) {
      const chainId = getChainIdHex(storage.account.chain);

      // Notify the tab about chain change
      try {
        await chrome.tabs.sendMessage(pending.tabId, {
          type: WindowMessageType.WAILLET_PROVIDER_UPDATE,
          chainId
        });
        console.log(`[Waillet] Emitted chainChanged event: ${chainId}`);
      } catch (err) {
        console.error('[Waillet] Failed to emit chainChanged event:', err);
      }
    }
  }

  // Cleanup
  pendingRequests.delete(requestId);
  await chrome.storage.local.remove('pendingRequest');

  sendResponse({ success: true });
}

/**
 * Convert chain name to hex chainId
 */
function getChainIdHex(chainName: string): string {
  const chainIds: Record<string, number> = {
    'ethereum': 1,
    'sepolia': 11155111,
    'base-sepolia': 84532,
    'polygon': 137,
    'bsc': 56,
    'base': 8453
  };

  const chainId = chainIds[chainName.toLowerCase()];
  return chainId ? `0x${chainId.toString(16)}` : '0x1';
}

// Cleanup old pending requests (older than 5 minutes)
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  for (const [id, request] of pendingRequests.entries()) {
    if (now - request.timestamp > timeout) {
      console.log(`[Waillet] Cleaning up expired request ${id}`);
      pendingRequests.delete(id);
    }
  }
}, 60000); // Run every minute

