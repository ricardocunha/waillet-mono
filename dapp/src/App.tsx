import { useState } from 'react'
import { useWallet } from './hooks'
import {
  Header,
  WalletModal,
  ConnectWallet,
  MainLayout,
  ActionTabs,
  SendComingSoon,
  SwapForm,
  SignalsPanel,
  AgentChat,
} from './components'
import { BridgeForm } from './components/BridgeForm'

function App() {
  const wallet = useWallet()
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <Header>
        <ConnectWallet
          address={wallet.address}
          isConnecting={wallet.isConnecting}
          onConnect={() => setIsWalletModalOpen(true)}
          onDisconnect={wallet.disconnect}
        />
      </Header>

      {/* Main Content */}
      <MainLayout
        actionArea={
          <ActionTabs>
            {(activeTab) => {
              switch (activeTab) {
                case 'bridge':
                  return (
                    <BridgeForm
                      currentChain={wallet.chain}
                      signer={wallet.signer}
                      isConnected={wallet.isConnected}
                      onSwitchChain={wallet.switchChain}
                    />
                  )
                case 'swap':
                  return (
                    <SwapForm
                      currentChain={wallet.chain}
                      signer={wallet.signer}
                      isConnected={wallet.isConnected}
                      onSwitchChain={wallet.switchChain}
                    />
                  )
                case 'send':
                  return <SendComingSoon />
                case 'signals':
                  return <SignalsPanel />
                default:
                  return null
              }
            }}
          </ActionTabs>
        }
        historyArea={
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
            <p className="text-slate-400">History will be added in a later phase</p>
          </div>
        }
        agentArea={
          <AgentChat
            walletAddress={wallet.address}
            chain={wallet.chain}
            chainId={wallet.chainId}
            signer={wallet.signer}
            onSwitchChain={wallet.switchChain}
          />
        }
      />

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnect={(providerType) => {
          wallet.connect(providerType)
          setIsWalletModalOpen(false)
        }}
        isConnecting={wallet.isConnecting}
      />

      {/* Error Display */}
      {wallet.error && (
        <div className="fixed bottom-4 right-4 bg-red-900/90 border border-red-700 text-red-200 px-4 py-3 rounded-lg max-w-md">
          {wallet.error}
        </div>
      )}
    </div>
  )
}

export default App