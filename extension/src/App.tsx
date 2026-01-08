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
    if (isUnlocked && hasWallet) {
      checkForPendingRequest();
      loadCurrentChain();
    }
  }, [isUnlocked, hasWallet]);

  const checkForPendingRequest = async () => {
    const result = await chrome.storage.local.get(StorageKey.PENDING_REQUEST);
    if (result.pendingRequest) {
      setPendingRequest(result.pendingRequest);
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

    setPendingRequest(null);
  };

  const handleTransactionApproval = async (txHash: string) => {
    if (!pendingRequest) return;

    await chrome.runtime.sendMessage({
      type: 'USER_DECISION',
      requestId: pendingRequest.id,
      approved: true,
      result: txHash
    });

    setPendingRequest(null);
  };

  const handleTransactionRejection = async (error?: string) => {
    if (!pendingRequest) return;

    await chrome.runtime.sendMessage({
      type: 'USER_DECISION',
      requestId: pendingRequest.id,
      approved: false,
      error: { code: 4001, message: error || 'User rejected transaction' }
    });

    setPendingRequest(null);
  };

  const handleSignatureApproval = async () => {
    if (!pendingRequest || !account) return;

    try {
      let signature: string;

      // Get encrypted wallet
      const result = await chrome.storage.local.get(StorageKey.ENCRYPTED_WALLET);
      if (!result.encryptedWallet) {
        throw new Error('Wallet not found');
      }

      const { WalletService } = await import('./services/wallet');
      const privateKey = account.privateKey;

      // Sign based on method type
      if (pendingRequest.type === PendingRequestType.SIGN_MESSAGE) {
        if (!pendingRequest.message) {
          throw new Error('No message to sign');
        }
        signature = await WalletService.signMessage(privateKey, pendingRequest.message);
      } else if (pendingRequest.type === PendingRequestType.SIGN_TYPED_DATA) {
        if (!pendingRequest.typedData) {
          throw new Error('No typed data to sign');
        }
        const { domain, types, message: msgValue } = pendingRequest.typedData;
        signature = await WalletService.signTypedData(privateKey, domain, types, msgValue);
      } else {
        throw new Error('Unknown signature type');
      }

      // Send signature to background
      await chrome.runtime.sendMessage({
        type: 'USER_DECISION',
        requestId: pendingRequest.id,
        approved: true,
        result: signature
      });

      setPendingRequest(null);
    } catch (error: any) {
      console.error('Signature error:', error);
      await handleSignatureRejection();
    }
  };

  const handleSignatureRejection = async () => {
    if (!pendingRequest) return;

    await chrome.runtime.sendMessage({
      type: 'USER_DECISION',
      requestId: pendingRequest.id,
      approved: false,
      error: { code: 4001, message: 'User rejected signature request' }
    });

    setPendingRequest(null);
  };

  const handleNetworkSwitch = async () => {
    if (!pendingRequest || !pendingRequest.chainName) return;

    try {
      // Get current account from storage
      const storage = await chrome.storage.local.get(StorageKey.ACCOUNT);
      const currentAccount = storage.account;

      if (!currentAccount) {
        throw new Error('No account found');
      }

      // Update the chain
      const updatedAccount = {
        ...currentAccount,
        chain: pendingRequest.chainName
      };

      await chrome.storage.local.set({ [StorageKey.ACCOUNT]: updatedAccount });

      // Send approval to background
      await chrome.runtime.sendMessage({
        type: 'USER_DECISION',
        requestId: pendingRequest.id,
        approved: true,
        result: null
      });

      setPendingRequest(null);

      // Reload window to reflect new chain
      window.location.reload();
    } catch (error: any) {
      console.error('Network switch error:', error);
      await handleNetworkSwitchRejection();
    }
  };

  const handleNetworkSwitchRejection = async () => {
    if (!pendingRequest) return;

    await chrome.runtime.sendMessage({
      type: 'USER_DECISION',
      requestId: pendingRequest.id,
      approved: false,
      error: { code: 4001, message: 'User rejected network switch' }
    });

    setPendingRequest(null);
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

  return (
    <>
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
      {pendingRequest?.type === PendingRequestType.SWITCH_NETWORK &&
        pendingRequest.chainName &&
        pendingRequest.chainId &&
        pendingRequest.chainIdDecimal !== undefined && (
        <NetworkSwitchModal
          origin={pendingRequest.origin}
          chainName={pendingRequest.chainName}
          chainIdDecimal={pendingRequest.chainIdDecimal}
          chainId={pendingRequest.chainId}
          currentChain={currentChain}
          onApprove={handleNetworkSwitch}
          onReject={handleNetworkSwitchRejection}
        />
      )}
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

