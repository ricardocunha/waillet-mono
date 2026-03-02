import { Layout } from '../components/layout/index.ts'
import { Container, Section } from '../components/ui/index.ts'

export function Privacy() {
  return (
    <Layout>
      <Section>
        <Container size="md">
          <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>

          <div className="prose prose-invert prose-slate max-w-none">
            <p className="text-slate-400 text-lg mb-8">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
              <p className="text-slate-400 mb-4">
                wAIllet ("we", "our", or "us") is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, and safeguard your information
                when you use our browser extension and web application.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">2. Self-Custody Wallet</h2>
              <p className="text-slate-400 mb-4">
                wAIllet is a self-custody wallet. This means:
              </p>
              <ul className="list-disc pl-6 text-slate-400 space-y-2">
                <li>Your private keys are stored locally on your device</li>
                <li>We never have access to your private keys or seed phrase</li>
                <li>You are solely responsible for securing your keys</li>
                <li>We cannot recover your wallet if you lose your seed phrase</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">3. Information We Collect</h2>
              <p className="text-slate-400 mb-4">
                We collect minimal information necessary to provide our services:
              </p>
              <ul className="list-disc pl-6 text-slate-400 space-y-2">
                <li><strong>Blockchain Data:</strong> Public blockchain addresses and transaction data (already public on the blockchain)</li>
                <li><strong>AI Interactions:</strong> Conversations with the AI agent for processing your requests</li>
                <li><strong>Usage Analytics:</strong> Anonymous usage statistics to improve the service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">4. How We Use Your Information</h2>
              <p className="text-slate-400 mb-4">
                We use collected information to:
              </p>
              <ul className="list-disc pl-6 text-slate-400 space-y-2">
                <li>Process your transaction requests</li>
                <li>Provide AI-powered assistance and risk analysis</li>
                <li>Improve our services and user experience</li>
                <li>Detect and prevent fraud or abuse</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">5. Data Security</h2>
              <p className="text-slate-400 mb-4">
                We implement industry-standard security measures to protect your data.
                However, no method of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">6. Third-Party Services</h2>
              <p className="text-slate-400 mb-4">
                We may use third-party services for blockchain data, price feeds, and AI processing.
                These services have their own privacy policies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">7. Contact Us</h2>
              <p className="text-slate-400 mb-4">
                If you have questions about this Privacy Policy, please contact us at{' '}
                <a href="mailto:privacy@waillet.io" className="text-purple-400 hover:text-purple-300">
                  privacy@waillet.io
                </a>
              </p>
            </section>
          </div>
        </Container>
      </Section>
    </Layout>
  )
}
