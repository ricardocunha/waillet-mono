import type { ChangeEvent } from 'react'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  balance?: string
  onMax?: () => void
  disabled?: boolean
  error?: string
  label?: string
  symbol?: string
}

export function AmountInput({
  value,
  onChange,
  balance,
  onMax,
  disabled = false,
  error,
  label,
  symbol = 'ETH',
}: AmountInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value

    // Allow empty string
    if (input === '') {
      onChange('')
      return
    }

    // Validate decimal number
    if (/^\d*\.?\d*$/.test(input)) {
      onChange(input)
    }
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-400 mb-2">
          {label}
        </label>
      )}
      <div className={`relative rounded-lg border ${error ? 'border-red-500' : 'border-slate-700'} bg-slate-800`}>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="0.0"
          className="w-full bg-transparent px-4 py-3 pr-20 text-white text-lg font-medium placeholder-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {onMax && balance && (
            <button
              type="button"
              onClick={onMax}
              disabled={disabled}
              className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded hover:bg-purple-600/30 transition-colors disabled:opacity-50"
            >
              MAX
            </button>
          )}
          <span className="text-slate-400 font-medium">{symbol}</span>
        </div>
      </div>

      {/* Balance and Error */}
      <div className="flex items-center justify-between mt-2 text-sm">
        {balance !== undefined && (
          <span className="text-slate-400">
            Balance: <span className="text-slate-300">{balance} {symbol}</span>
          </span>
        )}
        {error && (
          <span className="text-red-400 ml-auto">{error}</span>
        )}
      </div>
    </div>
  )
}
