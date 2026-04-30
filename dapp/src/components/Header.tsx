import { Wallet } from 'lucide-react'

interface HeaderProps {
  children?: React.ReactNode
}

export function Header({ children }: HeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Branding */}
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">
              wAIllet <span className="text-purple-400">DApp</span>
            </span>
          </div>

          {/* Right side - wallet connection slot */}
          <div className="flex items-center gap-4">
            {children}
          </div>
        </div>
      </div>
    </header>
  )
}
