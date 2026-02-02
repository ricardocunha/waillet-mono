import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Chain } from '../types'
import { CHAIN_CONFIG } from '../constants'

interface ChainSelectorProps {
  value: Chain
  onChange: (chain: Chain) => void
  chains?: Chain[]
  disabled?: boolean
  label?: string
}

export function ChainSelector({
  value,
  onChange,
  chains = Object.values(Chain),
  disabled = false,
  label,
}: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedConfig = CHAIN_CONFIG[value]

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-400 mb-2">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg transition-colors ${
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: selectedConfig.color }}
          />
          <span className="text-white font-medium">{selectedConfig.name}</span>
          {selectedConfig.isTestnet && (
            <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
              Testnet
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          {chains.map((chain) => {
            const config = CHAIN_CONFIG[chain]
            const isSelected = chain === value

            return (
              <button
                key={chain}
                type="button"
                onClick={() => {
                  onChange(chain)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  isSelected
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'text-white hover:bg-slate-700'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="font-medium">{config.name}</span>
                {config.isTestnet && (
                  <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                    Testnet
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
