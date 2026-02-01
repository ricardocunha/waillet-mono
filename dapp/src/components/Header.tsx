import { Wallet } from 'lucide-react'

interface HeaderProps {
  children?: React.ReactNode
}

const navLinks = [
  { label: 'Roadmap', href: '#', disabled: true },
  { label: 'Project', href: '#', disabled: true },
  { label: 'Contact', href: '#', disabled: true },
]

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

          {/* Navigation - hidden on mobile */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  link.disabled
                    ? 'text-slate-500 cursor-not-allowed'
                    : 'text-slate-300 hover:text-white'
                }`}
                onClick={(e) => link.disabled && e.preventDefault()}
                title={link.disabled ? 'Coming Soon' : undefined}
              >
                {link.label}
                {link.disabled && (
                  <span className="ml-1 text-xs text-slate-600">(Soon)</span>
                )}
              </a>
            ))}
          </nav>

          {/* Right side - wallet connection slot */}
          <div className="flex items-center gap-4">
            {children}
          </div>
        </div>
      </div>
    </header>
  )
}
