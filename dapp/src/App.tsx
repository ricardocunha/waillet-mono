import { useState } from 'react'
import { useWallet } from './hooks'
import {
  Header,
  WalletModal,
  ConnectWallet,
  MainLayout,
  ActionTabs,
  SwapComingSoon,
  SendComingSoon,
  SignalsComingSoon,
} from './components'

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
                    <div className="text-center py-8 text-slate-400">
                      Bridge form will be added in the next phase
                    </div>
                  )
                case 'swap':
                  return <SwapComingSoon />
                case 'send':
                  return <SendComingSoon />
                case 'signals':
                  return <SignalsComingSoon />
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
          <div className="flex flex-col h-full">
            <h2 className="text-lg font-semibold text-white mb-4">AI Agent</h2>
            <div className="flex-1 flex items-center justify-center text-slate-400">
              AI Agent chat will be added in a later phase
            </div>
          </div>
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
