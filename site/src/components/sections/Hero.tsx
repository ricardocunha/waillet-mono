import { ArrowRight, Shield } from 'lucide-react'
import { Button, Container, Badge } from '../ui/index.ts'

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-3xl" />

      <Container className="relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <Badge variant="purple" className="animate-fade-in-up">
              <Shield className="w-4 h-4 mr-2" />
              AI-Powered Security
            </Badge>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 animate-fade-in-up animation-delay-100">
            Your AI-Powered{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600">
              Crypto Guardian
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
            The intelligent crypto wallet that protects your assets with real-time risk analysis
            and lets you manage everything through natural conversation.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-300">
            <Button href="#downloads" size="lg">
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button href="/dapp" variant="secondary" size="lg">
              Try DApp
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-slate-500 animate-fade-in-up animation-delay-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Self-Custody
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Open Source
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Multi-Chain
            </div>
          </div>
        </div>

        {/* Hero Image */}
        <div className="mt-16 max-w-3xl mx-auto">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-600/20 rounded-full blur-3xl" />
            <img
              src="/images/freepik_smart_wallet.png"
              alt="wAIllet - AI-Powered Smart Wallet"
              className="relative w-full h-auto"
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
