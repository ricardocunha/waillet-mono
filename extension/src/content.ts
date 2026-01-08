/**
 * Waillet Content Script
 *
 * This script acts as a bridge between the inpage script (webpage context) and
 * the background script (extension context). It:
 * 1. Injects the inpage script into every webpage
 * 2. Relays messages between webpage and extension
 * 3. Validates message structure and origin for security
 *
 * Runs in an isolated context with access to both DOM and Chrome APIs.
 */

// Inject inpage script into the webpage
function injectInpageScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/inpage.js');
    script.type = 'module';

    script.onload = function() {
      // Remove script tag after execution to clean up DOM
      script.remove();
      console.log('[Waillet Content] Inpage script injected successfully');
    };

    script.onerror = function() {
      console.error('[Waillet Content] Failed to inject inpage script');
    };

    // Inject before any other scripts
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error('[Waillet Content] Error injecting inpage script:', error);
  }
}

// Inject immediately at document_start
if (document.readyState === 'loading') {
  injectInpageScript();
} else {
  // DOM already loaded, inject now
  injectInpageScript();
}

/**
 * Handle messages from inpage script (webpage)
 */
window.addEventListener('message', async (event) => {
  // Security: Only accept messages from same window
  if (event.source !== window) return;

  const message = event.data;

  // Filter for our messages only
  if (!message || message.type !== 'WAILLET_REQUEST') return;

  // Validate message structure
  if (!message.method || !Array.isArray(message.params) || typeof message.id !== 'number') {
    console.error('[Waillet Content] Invalid message format:', message);
    sendErrorToInpage(message.id, 'Invalid request format', 4200);
    return;
  }

  try {
    // Forward to background script
    const response = await chrome.runtime.sendMessage({
      type: 'DAPP_REQUEST',
      method: message.method,
      params: message.params,
      origin: window.location.origin,
      id: message.id,
      timestamp: Date.now()
    });

    // Send response back to inpage
    window.postMessage({
      type: 'WAILLET_RESPONSE',
      id: message.id,
      result: response.result,
      error: response.error
    }, '*');

  } catch (error: any) {
    console.error('[Waillet Content] Error forwarding request:', error);
    sendErrorToInpage(message.id, error.message || 'Internal error', 4900);
  }
});

/**
 * Handle messages from background script
 */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Handle responses from background (e.g., after user approval)
  if (request.type === 'WAILLET_RESPONSE') {
    // Forward to inpage
    window.postMessage({
      type: 'WAILLET_RESPONSE',
      id: request.id,
      result: request.result,
      error: request.error
    }, '*');

    sendResponse({ success: true });
    return true;
  }

  // Handle provider state updates
  if (request.type === 'PROVIDER_UPDATE') {
    window.postMessage({
      type: 'WAILLET_PROVIDER_UPDATE',
      accounts: request.accounts,
      chainId: request.chainId
    }, '*');

    sendResponse({ success: true });
    return true;
  }

  return false;
});

/**
 * Send error message to inpage script
 */
function sendErrorToInpage(id: number, message: string, code: number = 4001) {
  window.postMessage({
    type: 'WAILLET_RESPONSE',
    id,
    result: null,
    error: {
      code,
      message
    }
  }, '*');
}

/**
 * Notify background that content script is ready
 */
chrome.runtime.sendMessage({
  type: 'CONTENT_SCRIPT_READY',
  origin: window.location.origin,
  url: window.location.href
}).catch(() => {
  // Extension context may not be ready yet, ignore
});

console.log('[Waillet Content] Content script loaded for:', window.location.origin);
