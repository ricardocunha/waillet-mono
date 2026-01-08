import { BackgroundMessageType, EthMethod, PendingRequestType } from './types/messaging';

console.log('Waillet background loaded');

// Pending dApp requests queue
interface PendingRequest {
  id: number;
  method: string;
  params: any[];
  origin: string;
  timestamp: number;
  tabId: number;
  sendResponse?: Function; // Store the response callback
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
    handleDAppRequest(request, sender, sendResponse);
    return true;
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
async function handleDAppRequest(request: any, sender: any, sendResponse: Function) {
  const { method, params, origin, id } = request;
  const tabId = sender.tab?.id;

  console.log(`[Waillet] dApp request: ${method} from ${origin}`);

  // Handle read-only methods directly (no approval needed)
  if (READ_ONLY_METHODS.includes(method)) {
    await executeRPCCall(method, params, sendResponse);
    return;
  }

  // Methods requiring user approval
  if (method === EthMethod.REQUEST_ACCOUNTS) {
    await handleAccountsRequest(origin, tabId, id, sendResponse);
    return;
  }

  if (method === EthMethod.SEND_TRANSACTION) {
    await handleSendTransaction(params[0], origin, tabId, id, sendResponse);
    return;
  }

  // Signature methods
  if (method === EthMethod.PERSONAL_SIGN) {
    await handlePersonalSign(params, origin, tabId, id, sendResponse);
    return;
  }

  if (method === EthMethod.SIGN_TYPED_DATA_V4) {
    await handleSignTypedDataV4(params, origin, tabId, id, sendResponse);
    return;
  }

  if (method === EthMethod.SIGN) {
    await handleEthSign(params, origin, tabId, id, sendResponse);
    return;
  }

  // Unsupported method
  sendResponse({
    error: {
      code: 4200,
      message: `Method ${method} not supported`
    }
  });
}

/**
 * Execute RPC call for read-only methods
 */
async function executeRPCCall(method: string, params: any[], sendResponse: Function) {
  try {
    // Get current chain from storage (default to sepolia for testing)
    const storage = await chrome.storage.local.get('account');
    const chain = storage.account?.chain || 'sepolia';

    console.log(`[Waillet] Executing RPC call: ${method} on chain: ${chain}`);

    // Use existing RPC proxy
    const response = await fetch('http://localhost:8000/api/rpc/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chain,
        jsonrpc: '2.0',
        method,
        params,
        id: 1
      })
    });

    const data = await response.json();

    if (data.error) {
      sendResponse({ error: data.error });
    } else {
      sendResponse({ result: data.result });
    }
  } catch (error: any) {
    console.error('[Waillet] RPC call error:', error);
    sendResponse({
      error: {
        code: 4900,
        message: error.message
      }
    });
  }
}

/**
 * Handle eth_requestAccounts (wallet connection)
 */
async function handleAccountsRequest(origin: string, tabId: number, requestId: number, sendResponse: Function) {
  // Check if already connected
  const result = await chrome.storage.local.get('connectedSites');
  const connectedSites = result.connectedSites || {};

  if (connectedSites[origin]) {
    // Already connected, return account
    const accountResult = await chrome.storage.local.get('account');
    if (accountResult.account?.address) {
      console.log(`[Waillet] Already connected to ${origin}`);
      sendResponse({ result: [accountResult.account.address] });
      return;
    }
  }

  // Request user approval
  const internalId = ++requestCounter;
  pendingRequests.set(internalId, {
    id: requestId,
    method: EthMethod.REQUEST_ACCOUNTS,
    params: [],
    origin,
    timestamp: Date.now(),
    tabId,
    sendResponse // Store the callback to call later
  });

  // Open extension popup for approval
  await chrome.action.openPopup();

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

  // Note: Response will be sent via handleUserDecision
  // Don't call sendResponse here - keep the channel open
}

/**
 * Handle eth_sendTransaction
 */
async function handleSendTransaction(txParams: any, origin: string, tabId: number, requestId: number, sendResponse: Function) {
  const internalId = ++requestCounter;

  // Store pending transaction
  pendingRequests.set(internalId, {
    id: requestId,
    method: EthMethod.SEND_TRANSACTION,
    params: [txParams],
    origin,
    timestamp: Date.now(),
    tabId,
    sendResponse // Store the callback to call later
  });

  // Open extension for risk analysis
  await chrome.action.openPopup();

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

  console.log(`[Waillet] Transaction request from ${origin} (ID: ${internalId})`);

  // Response sent after user decision
  // Don't call sendResponse here - keep the channel open
}

/**
 * Handle personal_sign
 */
async function handlePersonalSign(params: any[], origin: string, tabId: number, requestId: number, sendResponse: Function) {
  const internalId = ++requestCounter;
  const [message, address] = params;

  pendingRequests.set(internalId, {
    id: requestId,
    method: EthMethod.PERSONAL_SIGN,
    params,
    origin,
    timestamp: Date.now(),
    tabId,
    sendResponse
  });

  await chrome.action.openPopup();

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
}

/**
 * Handle eth_signTypedData_v4
 */
async function handleSignTypedDataV4(params: any[], origin: string, tabId: number, requestId: number, sendResponse: Function) {
  const internalId = ++requestCounter;
  const [address, typedData] = params;

  let parsedData;
  try {
    parsedData = typeof typedData === 'string' ? JSON.parse(typedData) : typedData;
  } catch (e) {
    sendResponse({
      error: {
        code: 4100,
        message: 'Invalid typed data format'
      }
    });
    return;
  }

  pendingRequests.set(internalId, {
    id: requestId,
    method: EthMethod.SIGN_TYPED_DATA_V4,
    params,
    origin,
    timestamp: Date.now(),
    tabId,
    sendResponse
  });

  await chrome.action.openPopup();

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
}

/**
 * Handle eth_sign (dangerous, warn user)
 */
async function handleEthSign(params: any[], origin: string, tabId: number, requestId: number, sendResponse: Function) {
  const internalId = ++requestCounter;
  const [address, message] = params;

  pendingRequests.set(internalId, {
    id: requestId,
    method: EthMethod.SIGN,
    params,
    origin,
    timestamp: Date.now(),
    tabId,
    sendResponse
  });

  await chrome.action.openPopup();

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

  // Call the stored sendResponse callback to send result back to content script
  if (pending.sendResponse) {
    if (approved) {
      pending.sendResponse({ result: result });
    } else {
      pending.sendResponse({
        error: error || { code: 4001, message: 'User rejected request' }
      });
    }
  }

  // Cleanup
  pendingRequests.delete(requestId);
  await chrome.storage.local.remove('pendingRequest');

  sendResponse({ success: true });
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

