/**
 * Bridge between webpage and extension
 * Injects inpage script, relays messages, validates origins
 */

import { BackgroundMessageType, WindowMessageType } from './types/messaging';

function injectInpageScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/inpage.js');
    script.type = 'module';

    script.onload = function() {
      script.remove();
      console.log('[Waillet Content] Inpage script injected successfully');
    };

    script.onerror = function() {
      console.error('[Waillet Content] Failed to inject inpage script');
    };

    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error('[Waillet Content] Error injecting inpage script:', error);
  }
}

if (document.readyState === 'loading') {
  injectInpageScript();
} else {
  injectInpageScript();
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;

  const message = event.data;

  if (!message || message.type !== WindowMessageType.WAILLET_REQUEST) return;

  if (!message.method || !Array.isArray(message.params) || typeof message.id !== 'number') {
    console.error('[Waillet Content] Invalid message format:', message);
    sendErrorToInpage(message.id, 'Invalid request format', 4200);
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: BackgroundMessageType.DAPP_REQUEST,
      method: message.method,
      params: message.params,
      origin: window.location.origin,
      id: message.id,
      timestamp: Date.now()
    });

    window.postMessage({
      type: WindowMessageType.WAILLET_RESPONSE,
      id: message.id,
      result: response.result,
      error: response.error
    }, '*');

  } catch (error: any) {
    console.error('[Waillet Content] Error forwarding request:', error);
    sendErrorToInpage(message.id, error.message || 'Internal error', 4900);
  }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === WindowMessageType.WAILLET_RESPONSE) {
    window.postMessage({
      type: WindowMessageType.WAILLET_RESPONSE,
      id: request.id,
      result: request.result,
      error: request.error
    }, '*');

    sendResponse({ success: true });
    return true;
  }

  if (request.type === WindowMessageType.WAILLET_PROVIDER_UPDATE) {
    window.postMessage({
      type: WindowMessageType.WAILLET_PROVIDER_UPDATE,
      accounts: request.accounts,
      chainId: request.chainId
    }, '*');

    sendResponse({ success: true });
    return true;
  }

  return false;
});

function sendErrorToInpage(id: number, message: string, code: number = 4001) {
  window.postMessage({
    type: WindowMessageType.WAILLET_RESPONSE,
    id,
    result: null,
    error: {
      code,
      message
    }
  }, '*');
}

chrome.runtime.sendMessage({
  type: BackgroundMessageType.CONTENT_SCRIPT_READY,
  origin: window.location.origin,
  url: window.location.href
}).catch(() => {});

console.log('[Waillet Content] Content script loaded for:', window.location.origin);
