import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`
        bg-slate-900 border border-slate-800 rounded-xl p-6
        ${hover ? 'hover:border-purple-500/50 hover:bg-slate-800/50 transition-all duration-300' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

interface CardIconProps {
  children: ReactNode
  className?: string
}

export function CardIcon({ children, className = '' }: CardIconProps) {
  return (
    <div className={`bg-purple-600/20 p-3 rounded-lg w-fit mb-4 ${className}`}>
      {children}
    </div>
  )
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-xl font-semibold text-white mb-2 ${className}`}>
      {children}
    </h3>
  )
}

interface CardDescriptionProps {
  children: ReactNode
  className?: string
}

export function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={`text-slate-400 leading-relaxed ${className}`}>
      {children}
    </p>
  )
}
