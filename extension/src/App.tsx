import { useState, useEffect } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import { Onboarding } from './components/Onboarding';
import { Unlock } from './components/Unlock';
import { Dashboard } from './components/Dashboard';
import { AgentChat } from './components/AgentChat';
import { ConnectionApprovalModal } from './components/ConnectionApprovalModal';
import { DAppTransactionModal } from './components/DAppTransactionModal';
import { SignatureApprovalModal } from './components/SignatureApprovalModal';
import { NetworkSwitchModal } from './components/NetworkSwitchModal';
import { Bot, Wallet } from 'lucide-react';
import { PendingRequestType, EthMethod } from './types/messaging';
import { StorageKey } from './constants';
import { Chain } from './types/messaging';

type Mode = 'wallet' | 'agent';

interface PendingRequest {
  id: number;
  type: PendingRequestType;
  origin: string;
  txParams?: any;
  message?: string;
  typedData?: any;
  method?: EthMethod;
  dangerous?: boolean;
  chainId?: string;
  chainIdDecimal?: number;
  chainName?: string;
  tabId: number;
  timestamp: number;
}

function AppContent() {
  const { isUnlocked, hasWallet, isLoading, account } = useWallet();
  const [mode, setMode] = useState<Mode>('wallet');
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [currentChain, setCurrentChain] = useState<string>('sepolia');

  // Check for pending dApp requests on mount and when unlocked
  useEffect(() => {
    console.log('[App] Checking for pending requests, isUnlocked:', isUnlocked, 'hasWallet:', hasWallet);
    if (isUnlocked && hasWallet) {
      checkForPendingRequest();
      loadCurrentChain();
    }
  }, [isUnlocked, hasWallet]);

  // Listen for storage changes to detect new pending requests
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[StorageKey.PENDING_REQUEST]) {
        const newValue = changes[StorageKey.PENDING_REQUEST].newValue;
        console.log('🔔 Storage change detected - pending request:', newValue);
        if (newValue) {
          setPendingRequest(newValue);
        } else {
          setPendingRequest(null);
        }
      }
    };

    chrome.storage.local.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.local.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pendingRequest) {
        console.log('[App] Component unmounting with pending request, cleaning up');
        chrome.storage.local.remove(StorageKey.PENDING_REQUEST).catch(console.error);
      }
    };
  }, [pendingRequest]);

  const checkForPendingRequest = async () => {
    const result = await chrome.storage.local.get(StorageKey.PENDING_REQUEST);
    if (result.pendingRequest) {
      console.log('[App] 📋 Pending request detected on mount/unlock:', result.pendingRequest);
      setPendingRequest(result.pendingRequest);
    } else {
      console.log('[App] ✅ No pending request found');
    }
  };

  const loadCurrentChain = async () => {
    const result = await chrome.storage.local.get(StorageKey.ACCOUNT);
    if (result.account?.chain) {
      setCurrentChain(result.account.chain);
    }
  };

  const handleConnectionApproval = async (approved: boolean) => {
    if (!pendingRequest) return;

    try {
      if (approved && account) {
        // Save connected site
        const result = await chrome.storage.local.get(StorageKey.CONNECTED_SITES);
        const connectedSites = result.connectedSites || {};
        connectedSites[pendingRequest.origin] = {
          connected: true,
          timestamp: Date.now()
        };
        await chrome.storage.local.set({ [StorageKey.CONNECTED_SITES]: connectedSites });

        // Send approval to background
        await chrome.runtime.sendMessage({
          type: 'USER_DECISION',
          requestId: pendingRequest.id,
          approved: true,
          result: [account.address]
        });
      } else {
        // Send rejection to background
        await chrome.runtime.sendMessage({
          type: 'USER_DECISION',
          requestId: pendingRequest.id,
          approved: false,
          error: { code: 4001, message: 'User rejected request' }
        });
      }
    } catch (err) {
      console.error('[App] Failed to send connection decision to background:', err);
    }

    // Always clean up local state and storage
    setPendingRequest(null);
    await chrome.storage.local.remove(StorageKey.PENDING_REQUEST);
  };

  const handleTransactionApproval = async (txHash: string) => {
    if (!pendingRequest) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'USER_DECISION',
        requestId: pendingRequest.id,
        approved: true,
        result: txHash
      });
    } catch (err) {
      console.error('[App] Failed to send transaction approval to background:', err);
    }

    // Always clean up local state and storage
    setPendingRequest(null);
    await chrome.storage.local.remove(StorageKey.PENDING_REQUEST);
  };

  const handleTransactionRejection = async (error?: string) => {
    if (!pendingRequest) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'USER_DECISION',
        requestId: pendingRequest.id,
        approved: false,
        error: { code: 4001, message: error || 'User rejected transaction' }
      });
    } catch (err) {
      console.error('[App] Failed to send rejection to background:', err);
    }

    // Always clean up local state and storage
    setPendingRequest(null);
    await chrome.storage.local.remove(StorageKey.PENDING_REQUEST);
  };

  const handleSignatureApproval = async () => {
    console.log('[App] 🖊️ handleSignatureApproval called');
    console.log('[App] pendingRequest:', pendingRequest);
    console.log('[App] account:', account ? 'exists' : 'null');

    if (!pendingRequest || !account) {
      console.error('[App] Missing pendingRequest or account');
      return;
    }

    try {
      let signature: string;

      const { WalletService } = await import('./services/wallet');
      const privateKey = account.privateKey;

      if (!privateKey) {
        throw new Error('Private key not available');
      }

      console.log('[App] Signing with type:', pendingRequest.type);

      // Sign based on method type
      if (pendingRequest.type === PendingRequestType.SIGN_MESSAGE) {
        if (!pendingRequest.message) {
          throw new Error('No message to sign');
        }
        console.log('[App] Signing message...');
        signature = await WalletService.signMessage(privateKey, pendingRequest.message);
      } else if (pendingRequest.type === PendingRequestType.SIGN_TYPED_DATA) {
        if (!pendingRequest.typedData) {
          throw new Error('No typed data to sign');
        }
        console.log('[App] Signing typed data...');
        const { domain, types, message: msgValue } = pendingRequest.typedData;
        signature = await WalletService.signTypedData(privateKey, domain, types, msgValue);
      } else {
        throw new Error('Unknown signature type');
      }

      console.log('[App] ✅ Signature created:', signature.substring(0, 20) + '...');

      // Send signature to background
      try {
        console.log('[App] Sending signature to background, requestId:', pendingRequest.id);
        await chrome.runtime.sendMessage({
          type: 'USER_DECISION',
          requestId: pendingRequest.id,
          approved: true,
          result: signature
        });
        console.log('[App] ✅ Signature sent to background');
      } catch (err) {
        console.error('[App] ❌ Failed to send signature approval to background:', err);
      }

      // Always clean up local state and storage
      setPendingRequest(null);
      await chrome.storage.local.remove(StorageKey.PENDING_REQUEST);
      console.log('[App] ✅ Cleanup complete');
    } catch (error: any) {
      console.error('[App] ❌ Signature error:', error);
      await handleSignatureRejection();
    }
  };

  const handleSignatureRejection = async () => {
    if (!pendingRequest) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'USER_DECISION',
        requestId: pendingRequest.id,
        approved: false,
        error: { code: 4001, message: 'User rejected signature request' }
      });
    } catch (err) {
      console.error('[App] Failed to send signature rejection to background:', err);
    }

    // Always clean up local state and storage
    setPendingRequest(null);
    await chrome.storage.local.remove(StorageKey.PENDING_REQUEST);
  };

  const handleNetworkSwitch = async () => {
    if (!pendingRequest || !pendingRequest.chainName) return;

    if (!account) {
      console.error('❌ No account available');
      await handleNetworkSwitchRejection();
      return;
    }

    try {
      // Update the chain in storage using the account from context
      const updatedAccount = {
        ...account,
        chain: pendingRequest.chainName
      };

      await chrome.storage.local.set({ [StorageKey.ACCOUNT]: updatedAccount });

      // Send approval to background
      try {
        await chrome.runtime.sendMessage({
          type: 'USER_DECISION',
          requestId: pendingRequest.id,
          approved: true,
          result: null
        });
      } catch (err) {
        console.error('[App] Failed to send network switch approval to background:', err);
      }

      // Always clean up local state and storage
      setPendingRequest(null);
      await chrome.storage.local.remove(StorageKey.PENDING_REQUEST);

      // No need to reload - WalletContext storage listener will auto-update
      // and Dashboard will sync with the new chain
    } catch (error: any) {
      console.error('Network switch error:', error);
      await handleNetworkSwitchRejection();
    }
  };

  const handleNetworkSwitchRejection = async () => {
    if (!pendingRequest) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'USER_DECISION',
        requestId: pendingRequest.id,
        approved: false,
        error: { code: 4001, message: 'User rejected network switch' }
      });
    } catch (err) {
      console.error('[App] Failed to send network switch rejection to background:', err);
    }

    // Always clean up local state and storage
    setPendingRequest(null);
    await chrome.storage.local.remove(StorageKey.PENDING_REQUEST);
  };

  if (isLoading) {
    return (
      <div className="h-full bg-slate-900 flex items-center justify-center">
        <div className="text-purple-500">Loading...</div>
      </div>
    );
  }

  if (!hasWallet) {
    return <Onboarding />;
  }

  if (!isUnlocked) {
    return <Unlock />;
  }

  // Log what modal should be shown
  if (pendingRequest) {
    console.log('[App] 🎯 Pending request detected:', {
      id: pendingRequest.id,
      type: pendingRequest.type,
      method: pendingRequest.method,
      origin: pendingRequest.origin
    });
  }

  return (
    <>
      {/* Hide main content when modal is showing */}
      {!pendingRequest && (
        <div className="h-full flex flex-col">
          <div className="bg-slate-800 border-b border-slate-700 flex">
            <button
              onClick={() => setMode('wallet')}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 font-semibold transition-colors ${
                mode === 'wallet'
                  ? 'bg-slate-900 text-purple-400 border-b-2 border-purple-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Wallet size={18} />
              Wallet
            </button>
            <button
              onClick={() => setMode('agent')}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 font-semibold transition-colors ${
                mode === 'agent'
                  ? 'bg-slate-900 text-purple-400 border-b-2 border-purple-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Bot size={18} />
              AI Agent
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {mode === 'wallet' ? <Dashboard /> : <AgentChat />}
          </div>
        </div>
      )}

      {/* dApp Request Modals */}
      {pendingRequest?.type === PendingRequestType.CONNECT && (
        <ConnectionApprovalModal
          origin={pendingRequest.origin}
          onApprove={() => handleConnectionApproval(true)}
          onReject={() => handleConnectionApproval(false)}
        />
      )}

      {pendingRequest?.type === PendingRequestType.TRANSACTION && pendingRequest.txParams && (
        <DAppTransactionModal
          txParams={pendingRequest.txParams}
          origin={pendingRequest.origin}
          onApprove={handleTransactionApproval}
          onReject={handleTransactionRejection}
        />
      )}

      {/* Signature Request Modals */}
      {(pendingRequest?.type === PendingRequestType.SIGN_MESSAGE ||
        pendingRequest?.type === PendingRequestType.SIGN_TYPED_DATA) &&
        pendingRequest.method && (
        <SignatureApprovalModal
          origin={pendingRequest.origin}
          message={pendingRequest.message}
          typedData={pendingRequest.typedData}
          method={pendingRequest.method as EthMethod.PERSONAL_SIGN | EthMethod.SIGN | EthMethod.SIGN_TYPED_DATA_V4}
          dangerous={pendingRequest.dangerous}
          onApprove={handleSignatureApproval}
          onReject={handleSignatureRejection}
        />
      )}

      {/* Network Switch Modal */}
      {(() => {
        const shouldShow = pendingRequest?.type === PendingRequestType.SWITCH_NETWORK &&
          pendingRequest.chainName &&
          pendingRequest.chainId &&
          pendingRequest.chainIdDecimal !== undefined;

        console.log('🔍 Network Switch Modal Check:', {
          pendingRequestType: pendingRequest?.type,
          chainName: pendingRequest?.chainName,
          chainId: pendingRequest?.chainId,
          chainIdDecimal: pendingRequest?.chainIdDecimal,
          shouldShow
        });

        return shouldShow ? (
          <NetworkSwitchModal
            origin={pendingRequest!.origin}
            chainName={pendingRequest!.chainName as Chain}
            chainIdDecimal={pendingRequest!.chainIdDecimal!}
            chainId={pendingRequest!.chainId!}
            currentChain={currentChain as Chain}
            onApprove={handleNetworkSwitch}
            onReject={handleNetworkSwitchRejection}
          />
        ) : null;
      })()}
    </>
  );
}

function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App;

