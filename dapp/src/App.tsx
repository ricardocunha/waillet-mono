import { useState, useCallback, useEffect } from 'react'
import { useWallet, useAuth, useFavorites } from './hooks'
import {
  Header,
  WalletModal,
  ConnectWallet,
  MainLayout,
  ActionTabs,
  SwapForm,
  SignalsPanel,
  AgentChat,
  SendForm,
  FavoritesPanel,
  useToast,
} from './components'
import type { ActionTab } from './components'
import type { IntentResponse } from './types'
import { Token } from './types'
import { BridgeForm } from './components/BridgeForm'
import { TransferHistory } from './components/TransferHistory'

function App() {
  const wallet = useWallet()
  useAuth(wallet.signer)
  const favorites = useFavorites(wallet.address)
  const { showToast } = useToast()
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ActionTab>('bridge')
  const [sendPrefill, setSendPrefill] = useState<{ to?: string; amount?: string; token?: Token }>({})

  // Show wallet errors as toasts
  useEffect(() => {
    if (wallet.error) {
      showToast('error', wallet.error)
    }
  }, [wallet.error, showToast])

  const handleTransfer = useCallback((intent: IntentResponse) => {
    setSendPrefill({
      to: intent.to || '',
      amount: intent.value || '',
      token: (intent.token as Token) || Token.ETH,
    })
    setActiveTab('send')
  }, [])

  const handleSaveFavorite = useCallback(async (intent: IntentResponse) => {
    if (!wallet.address || !intent.to) return
    await favorites.saveFavorite({
      wallet_address: wallet.address,
      alias: intent.alias || intent.to,
      address: intent.to,
      chain: intent.chain || '',
    })
  }, [wallet.address, favorites])

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
          <ActionTabs activeTab={activeTab} onTabChange={setActiveTab}>
            {(currentTab) => {
              switch (currentTab) {
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
                  return (
                    <SendForm
                      currentChain={wallet.chain}
                      signer={wallet.signer}
                      isConnected={wallet.isConnected}
                      onSwitchChain={wallet.switchChain}
                      prefillTo={sendPrefill.to}
                      prefillAmount={sendPrefill.amount}
                      prefillToken={sendPrefill.token}
                    />
                  )
                case 'signals':
                  return <SignalsPanel />
                default:
                  return null
              }
            }}
          </ActionTabs>
        }
        historyArea={
          <>
            <TransferHistory address={wallet.address} chain={wallet.chain} />
            <FavoritesPanel
              favorites={favorites.favorites}
              isLoading={favorites.isLoading}
              error={favorites.error}
              walletAddress={wallet.address}
              onSave={favorites.saveFavorite}
              onDelete={favorites.deleteFavorite}
              onSelect={(address) => {
                setSendPrefill((prev) => ({ ...prev, to: address }))
                setActiveTab('send')
              }}
            />
          </>
        }
        agentArea={
          <AgentChat
            walletAddress={wallet.address}
            chain={wallet.chain}
            chainId={wallet.chainId}
            signer={wallet.signer}
            onSwitchChain={wallet.switchChain}
            onTransfer={handleTransfer}
            onSaveFavorite={handleSaveFavorite}
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
    </div>
  )
}

export default App