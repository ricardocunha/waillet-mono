import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Lock } from 'lucide-react'
import { Token } from '../types'
import { TOKEN_CONFIG } from '../constants'

interface TokenSelectorProps {
  value: Token
  onChange: (token: Token) => void
  tokens?: Token[]
  disabled?: boolean
  label?: string
}

export function TokenSelector({
  value,
  onChange,
  tokens = Object.values(Token),
  disabled = false,
  label,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedConfig = TOKEN_CONFIG[value]

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
          <span className="text-white font-medium">{selectedConfig.symbol}</span>
          <span className="text-slate-400 text-sm">{selectedConfig.name}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          {tokens.map((token) => {
            const config = TOKEN_CONFIG[token]
            const isSelected = token === value
            const isDisabled = !config.enabled

            return (
              <button
                key={token}
                type="button"
                onClick={() => {
                  if (!isDisabled) {
                    onChange(token)
                    setIsOpen(false)
                  }
                }}
                disabled={isDisabled}
                className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                  isSelected
                    ? 'bg-purple-600/20 text-purple-400'
                    : isDisabled
                    ? 'text-slate-500 cursor-not-allowed'
                    : 'text-white hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{config.symbol}</span>
                  <span className={`text-sm ${isDisabled ? 'text-slate-600' : 'text-slate-400'}`}>
                    {config.name}
                  </span>
                </div>
                {isDisabled && (
                  <div className="flex items-center gap-1 text-slate-500">
                    <Lock className="w-3 h-3" />
                    <span className="text-xs">Soon</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
