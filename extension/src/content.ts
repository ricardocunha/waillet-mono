/**
 * Bridge between webpage and extension
 * Injects inpage script, relays messages, validates origins
 */

import { BackgroundMessageType, WindowMessageType } from './types/messaging';

// Prevent duplicate content script injection
if ((window as any).__WAILLET_CONTENT_SCRIPT_LOADED__) {
  console.log('[Waillet Content] Already loaded, skipping...');
  throw new Error('Waillet content script already loaded');
}
(window as any).__WAILLET_CONTENT_SCRIPT_LOADED__ = true;

function injectInpageScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/inpage.js');

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

  console.log('[Waillet Content] 📨 Received request from page:', message.method, message);

  if (!message.method || !Array.isArray(message.params) || typeof message.id !== 'number') {
    console.error('[Waillet Content] Invalid message format:', message);
    sendErrorToInpage(message.id, 'Invalid request format', 4200);
    return;
  }

  try {
    chrome.runtime.sendMessage({
      type: BackgroundMessageType.DAPP_REQUEST,
      method: message.method,
      params: message.params,
      origin: window.location.origin,
      id: message.id,
      timestamp: Date.now()
    }).catch((error) => {
      // Handle errors
      console.error('[Waillet Content] Error sending to background:', error);
      sendErrorToInpage(message.id, error.message || 'Failed to communicate with extension', 4900);
    });

    // Response will be sent back via chrome.runtime.onMessage listener
    // (handled by the listener below that forwards WAILLET_RESPONSE messages)

  } catch (error: any) {
    console.error('[Waillet Content] Error forwarding request:', error);

    // Handle extension context invalidation
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.warn('[Waillet Content] Extension was reloaded. Please refresh this page to reconnect.');
      sendErrorToInpage(message.id, 'Waillet extension was updated. Please refresh this page.', 4900);

      // Show a user-friendly notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1e293b;
        color: #f8fafc;
        padding: 16px 24px;
        border-radius: 8px;
        border: 2px solid #a855f7;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 300px;
      `;
      notification.innerHTML = `
        <strong style="color: #a855f7;">Waillet Updated</strong><br>
        Please refresh this page to reconnect.
        <button onclick="window.location.reload()" style="
          display: block;
          margin-top: 12px;
          width: 100%;
          padding: 8px;
          background: #a855f7;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        ">Refresh Now</button>
      `;
      document.body.appendChild(notification);

      // Auto-remove after 10 seconds if not clicked
      setTimeout(() => notification.remove(), 10000);
    } else {
      sendErrorToInpage(message.id, error.message || 'Internal error', 4900);
    }
  }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('[Waillet Content] 📬 Received from background:', request);

  if (request.type === WindowMessageType.WAILLET_RESPONSE) {
    console.log('[Waillet Content] 📤 Forwarding response to page:', { id: request.id, result: request.result, error: request.error });

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
