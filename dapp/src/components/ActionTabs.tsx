import { useState } from 'react'
import { ArrowLeftRight, ArrowUpDown, Send, Bot } from 'lucide-react'

export type ActionTab = 'bridge' | 'swap' | 'send' | 'signals'

interface Tab {
  id: ActionTab
  label: string
  icon: React.ReactNode
  comingSoon: boolean
}

const tabs: Tab[] = [
  { id: 'bridge', label: 'Bridge', icon: <ArrowLeftRight className="w-4 h-4" />, comingSoon: false },
  { id: 'swap', label: 'Swap', icon: <ArrowUpDown className="w-4 h-4" />, comingSoon: true },
  { id: 'send', label: 'Send', icon: <Send className="w-4 h-4" />, comingSoon: true },
  { id: 'signals', label: 'AI Signals', icon: <Bot className="w-4 h-4" />, comingSoon: true },
]

interface ActionTabsProps {
  children: (activeTab: ActionTab) => React.ReactNode
}

export function ActionTabs({ children }: ActionTabsProps) {
  const [activeTab, setActiveTab] = useState<ActionTab>('bridge')

  return (
    <div>
      {/* Tab Headers */}
      <div className="flex border-b border-slate-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.comingSoon && setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-500 text-purple-400'
                : tab.comingSoon
                ? 'border-transparent text-slate-600 cursor-not-allowed'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
            disabled={tab.comingSoon}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.comingSoon && (
              <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {children(activeTab)}
      </div>
    </div>
  )
}
