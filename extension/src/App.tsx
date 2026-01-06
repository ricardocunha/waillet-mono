import { useState } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import { Onboarding } from './components/Onboarding';
import { Unlock } from './components/Unlock';
import { Dashboard } from './components/Dashboard';
import { AgentChat } from './components/AgentChat';
import { Bot, Wallet } from 'lucide-react';

type Mode = 'wallet' | 'agent';

function AppContent() {
  const { isUnlocked, hasWallet, isLoading } = useWallet();
  const [mode, setMode] = useState<Mode>('wallet');

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

