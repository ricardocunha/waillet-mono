import {
  Bot,
  Shield,
  Network,
  MessageSquare,
  AlertTriangle,
  Sparkles,
  Key,
  type LucideIcon,
} from 'lucide-react'

export interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

export const features: Feature[] = [
  {
    icon: Bot,
    title: 'AI Agent',
    description:
      'Execute transactions using natural language commands. Just tell the AI what you want to do, and it handles the complexity for you.',
  },
  {
    icon: Shield,
    title: 'Security Firewall',
    description:
      'Real-time risk analysis protects every transaction. Get instant warnings about suspicious contracts, phishing attempts, and risky operations.',
  },
  {
    icon: Network,
    title: 'Multi-Chain Support',
    description:
      'Seamlessly manage assets across multiple networks including Ethereum, Polygon, Arbitrum, and more - all from one unified interface.',
  },
]

export interface Benefit {
  icon: LucideIcon
  title: string
  description: string
}

export const benefits: Benefit[] = [
  {
    icon: MessageSquare,
    title: 'Natural Language Commands',
    description:
      'No more complex interfaces. Simply chat with your wallet to send, swap, or check balances.',
  },
  {
    icon: AlertTriangle,
    title: 'Risk Alerts',
    description:
      'Get instant notifications about potential threats before you sign any transaction.',
  },
  {
    icon: Sparkles,
    title: 'Simple Management',
    description:
      'One interface to manage all your crypto assets, NFTs, and DeFi positions across chains.',
  },
  {
    icon: Key,
    title: 'Self-Custody',
    description:
      'Your keys, your crypto. We never have access to your private keys or funds.',
  },
]

export interface Step {
  number: string
  title: string
  description: string
}

export const steps: Step[] = [
  {
    number: '01',
    title: 'Install Extension',
    description:
      'Download wAIllet from the Chrome Web Store or Firefox Add-ons. Installation takes just a few seconds.',
  },
  {
    number: '02',
    title: 'Create or Import Wallet',
    description:
      'Set up a new wallet with a secure seed phrase, or import your existing wallet to get started immediately.',
  },
  {
    number: '03',
    title: 'Start Using AI',
    description:
      'Open the AI Agent tab and start chatting. Send crypto, check balances, or analyze transactions with natural language.',
  },
]
