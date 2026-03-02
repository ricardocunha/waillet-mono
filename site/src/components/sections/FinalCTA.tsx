import { ArrowRight, Shield } from 'lucide-react'
import { Container, Section, Button } from '../ui/index.ts'

export function FinalCTA() {
  return (
    <Section className="bg-gradient-to-b from-slate-900/50 to-purple-900/20">
      <Container size="md">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 border border-purple-500/30 mb-6">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Secure Your Crypto?
          </h2>

          <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
            Join thousands of users who trust wAIllet to protect their digital assets
            with AI-powered security.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="#downloads" size="lg">
              Get Started Now
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button href="/dapp" variant="outline" size="lg">
              Try the DApp
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  )
}
