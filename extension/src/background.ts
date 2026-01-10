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
let popupWindowId: number | null = null;
// Track requests being processed to prevent race conditions
const processingRequests = new Set<string>();

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

// Track when popup windows are closed
chrome.windows.onRemoved.addListener(async (windowId) => {
  if (windowId === popupWindowId) {
    console.log('[Waillet] Popup window closed without user decision');
    popupWindowId = null;

    // Clean up any pending requests when popup closes without a decision
    const result = await chrome.storage.local.get('pendingRequest');
    if (result.pendingRequest) {
      const pendingReq = result.pendingRequest;
      console.log(`[Waillet] Cleaning up abandoned request ID: ${pendingReq.id}, type: ${pendingReq.type}`);

      // Find the internal request and send rejection
      const internalReq = pendingRequests.get(pendingReq.id);
      if (internalReq) {
        // Send rejection response to the dApp
        await sendResponseToTab(internalReq.tabId, internalReq.messageId, null, {
          code: 4001,
          message: 'User closed the wallet popup'
        });

        // Clean up
        pendingRequests.delete(pendingReq.id);
      }

      // Remove from storage
      await chrome.storage.local.remove('pendingRequest');
      console.log('[Waillet] ✅ Cleaned up abandoned pending request');
    }
  }
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

  // dApp request handler
  if (request.type === BackgroundMessageType.DAPP_REQUEST) {
    handleDAppRequest(request, sender);
    // Return false since we'll respond via chrome.tabs.sendMessage later
    return false;
  }

  // User decision handler
  if (request.type === BackgroundMessageType.USER_DECISION) {
    handleUserDecision(request, sendResponse);
    return true;
  }

  // Content script ready notification
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
 * Open or focus the extension popup window
 */
//TODO not fully functional yet
async function openOrFocusPopup(): Promise<void> {
  console.log(`[Waillet] openOrFocusPopup called, current popupWindowId: ${popupWindowId}`);

  try {
    // Check if popup window is still open
    if (popupWindowId !== null) {
      try {
        const existingWindow = await chrome.windows.get(popupWindowId);
        if (existingWindow && existingWindow.id) {
          // Window exists, just focus it and wait a bit to ensure it's ready
          console.log(`[Waillet] ✅ Found existing popup window (ID: ${popupWindowId}), focusing it`);
          await chrome.windows.update(popupWindowId, { focused: true });

          // Wait a bit to ensure window is focused before returning
          await new Promise(resolve => setTimeout(resolve, 100));
          return;
        }
      } catch (err) {
        // Window doesn't exist anymore
        console.log(`[Waillet] ⚠️ Popup window ${popupWindowId} no longer exists:`, err);
        popupWindowId = null;
      }
    }

    // Prevent multiple rapid window creations
    if (popupWindowId !== null) {
      console.log('[Waillet] ⚠️ Already creating a popup, skipping duplicate');
      return;
    }

    // Create new popup window
    console.log('[Waillet] Creating new popup window...');

    // Set popupWindowId to a temporary value to prevent race conditions
    const tempId = -1;
    popupWindowId = tempId;

    const window = await chrome.windows.create({
      url: chrome.runtime.getURL('index.html'),
      type: 'popup',
      width: 506,
      height: 600,
      focused: true
    });

    popupWindowId = window.id || null;
    console.log(`[Waillet] ✅ Created new popup window (ID: ${popupWindowId})`);
  } catch (error) {
    console.error('[Waillet] ❌ Failed to open popup:', error);
    popupWindowId = null;
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

  const message = {
    type: WindowMessageType.WAILLET_RESPONSE,
    id: messageId,
    result,
    error
  };

  try {
    console.log(`[Waillet] 📤 sendResponseToTab START`);
    console.log(`[Waillet]    TabId: ${tabId}`);
    console.log(`[Waillet]    MessageId: ${messageId}`);
    console.log(`[Waillet]    Result type:`, typeof result);
    if (typeof result === 'string') {
      console.log(`[Waillet]    Result (first 66 chars):`, result.substring(0, 66));
    } else if (result !== null) {
      console.log(`[Waillet]    Result:`, result);
    }
    console.log(`[Waillet]    Error:`, error);
    console.log(`[Waillet]    Sending to frameId: 0`);

    // Send only to the main frame (frameId: 0) to avoid duplicates
    await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
    console.log(`[Waillet] ✅ sendResponseToTab completed successfully`);
  } catch (err) {
    console.error('[Waillet] ❌ Failed to send response to tab:', err);
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
  await openOrFocusPopup();
  // TODO not the final solution yet
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

  // Open extension popup
  await openOrFocusPopup();

}

/**
 * Handle personal_sign
 */
async function handlePersonalSign(params: any[], origin: string, tabId: number, messageId: number) {
  const requestKey = `personal_sign:${origin}:${messageId}`;

  console.log(`[Waillet] 🖊️ handlePersonalSign called from ${origin}`);
  console.log(`[Waillet] params:`, params);
  console.log(`[Waillet] tabId: ${tabId}, messageId: ${messageId}`);

  // Check if we're already processing this exact request
  if (processingRequests.has(requestKey)) {
    console.log(`[Waillet] ⚠️ Already processing this request (${requestKey}), ignoring duplicate`);
    return;
  }

  // Check if there's already a pending request in storage
  const existingRequest = await chrome.storage.local.get('pendingRequest');
  if (existingRequest.pendingRequest) {
    console.log(`[Waillet] ⚠️ Already have a pending request, focusing existing popup`);
    await openOrFocusPopup();
    return;
  }

  // Mark this request as being processed
  processingRequests.add(requestKey);
  console.log(`[Waillet] 🔒 Marked request as processing: ${requestKey}`);

  try {
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

    console.log(`[Waillet] 💾 Storing pending request (ID: ${internalId})`);

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
    console.log(`[Waillet] 🚀 Opening popup...`);

    await openOrFocusPopup();
  } finally {
    // Clean up processing flag after a short delay
    setTimeout(() => {
      processingRequests.delete(requestKey);
      console.log(`[Waillet] 🔓 Removed processing flag: ${requestKey}`);
    }, 1000);
  }
}

/**
 * Handle eth_signTypedData_v4
 */
async function handleSignTypedDataV4(params: any[], origin: string, tabId: number, messageId: number) {
  const requestKey = `sign_typed_data_v4:${origin}:${messageId}`;

  console.log(`[Waillet] 📝 handleSignTypedDataV4 called from ${origin}`);
  console.log(`[Waillet] tabId: ${tabId}, messageId: ${messageId}`);

  // Check if we're already processing this exact request
  if (processingRequests.has(requestKey)) {
    console.log(`[Waillet] ⚠️ Already processing this request (${requestKey}), ignoring duplicate`);
    return;
  }

  // Check if there's already a pending request in storage
  const existingRequest = await chrome.storage.local.get('pendingRequest');
  if (existingRequest.pendingRequest) {
    console.log(`[Waillet] ⚠️ Already have a pending request, focusing existing popup`);
    await openOrFocusPopup();
    return;
  }

  // Mark this request as being processed
  processingRequests.add(requestKey);
  console.log(`[Waillet] 🔒 Marked request as processing: ${requestKey}`);

  try {
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
    console.log(`[Waillet] 🚀 Opening popup...`);

    await openOrFocusPopup();
  } finally {
    // Clean up processing flag after a short delay
    setTimeout(() => {
      processingRequests.delete(requestKey);
      console.log(`[Waillet] 🔓 Removed processing flag: ${requestKey}`);
    }, 1000);
  }
}

/**
 * Handle eth_sign (dangerous, warn user)
 */
async function handleEthSign(params: any[], origin: string, tabId: number, messageId: number) {
  const requestKey = `eth_sign:${origin}:${messageId}`;

  console.log(`[Waillet] ⚠️ handleEthSign called from ${origin} - DANGEROUS`);
  console.log(`[Waillet] tabId: ${tabId}, messageId: ${messageId}`);

  // Check if we're already processing this exact request
  if (processingRequests.has(requestKey)) {
    console.log(`[Waillet] ⚠️ Already processing this request (${requestKey}), ignoring duplicate`);
    return;
  }

  // Check if there's already a pending request in storage
  const existingRequest = await chrome.storage.local.get('pendingRequest');
  if (existingRequest.pendingRequest) {
    console.log(`[Waillet] ⚠️ Already have a pending request, focusing existing popup`);
    await openOrFocusPopup();
    return;
  }

  // Mark this request as being processed
  processingRequests.add(requestKey);
  console.log(`[Waillet] 🔒 Marked request as processing: ${requestKey}`);

  try {
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
    console.log(`[Waillet] 🚀 Opening popup...`);

    await openOrFocusPopup();
  } finally {
    // Clean up processing flag after a short delay
    setTimeout(() => {
      processingRequests.delete(requestKey);
      console.log(`[Waillet] 🔓 Removed processing flag: ${requestKey}`);
    }, 1000);
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

  // Open extension popup
  await openOrFocusPopup();
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

  console.log(`[Waillet] 👤 ===== handleUserDecision START =====`);
  console.log(`[Waillet] requestId: ${requestId}, approved: ${approved}`);
  console.log(`[Waillet] result type:`, typeof result);
  if (typeof result === 'string') {
    console.log(`[Waillet] result (first 66 chars):`, result.substring(0, 66));
  } else {
    console.log(`[Waillet] result:`, result);
  }
  console.log(`[Waillet] error:`, error);

  const pending = pendingRequests.get(requestId);
  if (!pending) {
    console.error(`[Waillet] ❌ Request ${requestId} not found in pending requests`);
    console.log(`[Waillet] Available request IDs:`, Array.from(pendingRequests.keys()));
    sendResponse({ error: 'Request not found or expired' });
    return;
  }

  console.log(`[Waillet] ✅ Found pending request:`);
  console.log(`[Waillet]    Method: ${pending.method}`);
  console.log(`[Waillet]    TabId: ${pending.tabId}`);
  console.log(`[Waillet]    MessageId: ${pending.messageId}`);
  console.log(`[Waillet]    Origin: ${pending.origin}`);

  // Send response back to the tab via chrome.tabs.sendMessage
  if (approved) {
    console.log(`[Waillet] 📤 Calling sendResponseToTab for APPROVAL...`);
    await sendResponseToTab(pending.tabId, pending.messageId, result, null);
    console.log(`[Waillet] ✅ sendResponseToTab completed for approval`);
  } else {
    console.log(`[Waillet] 📤 Calling sendResponseToTab for REJECTION...`);
    await sendResponseToTab(pending.tabId, pending.messageId, null, error || { code: 4001, message: 'User rejected request' });
    console.log(`[Waillet] ✅ sendResponseToTab completed for rejection`);
  }

  // If this was a network switch approval, emit chainChanged event
  if (approved && pending.method === EthMethod.WALLET_SWITCH_ETHEREUM_CHAIN) {
    const storage = await chrome.storage.local.get('account');
    if (storage.account?.chain) {
      const chainId = getChainIdHex(storage.account.chain);

      // Notify the tab about chain change (only main frame)
      try {
        await chrome.tabs.sendMessage(pending.tabId, {
          type: WindowMessageType.WAILLET_PROVIDER_UPDATE,
          chainId
        }, { frameId: 0 });
        console.log(`[Waillet] Emitted chainChanged event: ${chainId}`);
      } catch (err) {
        console.error('[Waillet] Failed to emit chainChanged event:', err);
      }
    }
  }

  // Cleanup
  pendingRequests.delete(requestId);
  await chrome.storage.local.remove('pendingRequest');

  // Close the popup window after decision is made
  if (popupWindowId !== null) {
    try {
      await chrome.windows.remove(popupWindowId);
      popupWindowId = null;
    } catch (err) {
      // Window might already be closed by user
      popupWindowId = null;
    }
  }

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

