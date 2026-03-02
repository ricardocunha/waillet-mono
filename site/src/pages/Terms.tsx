import { Layout } from '../components/layout/index.ts'
import { Container, Section } from '../components/ui/index.ts'

export function Terms() {
  return (
    <Layout>
      <Section>
        <Container size="md">
          <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>

          <div className="prose prose-invert prose-slate max-w-none">
            <p className="text-slate-400 text-lg mb-8">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-400 mb-4">
                By using wAIllet, you agree to these Terms of Service. If you do not agree,
                please do not use our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p className="text-slate-400 mb-4">
                wAIllet is a self-custody cryptocurrency wallet with AI-powered features.
                We provide tools to manage your digital assets, but we do not:
              </p>
              <ul className="list-disc pl-6 text-slate-400 space-y-2">
                <li>Hold or custody your funds</li>
                <li>Have access to your private keys</li>
                <li>Execute transactions on your behalf without your explicit approval</li>
                <li>Provide financial, investment, or legal advice</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">3. User Responsibilities</h2>
              <p className="text-slate-400 mb-4">
                You are responsible for:
              </p>
              <ul className="list-disc pl-6 text-slate-400 space-y-2">
                <li>Securing your seed phrase and private keys</li>
                <li>Understanding the risks of cryptocurrency transactions</li>
                <li>Verifying transaction details before signing</li>
                <li>Complying with applicable laws in your jurisdiction</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">4. Risks</h2>
              <p className="text-slate-400 mb-4">
                Cryptocurrency involves significant risks, including:
              </p>
              <ul className="list-disc pl-6 text-slate-400 space-y-2">
                <li>Price volatility and potential total loss of funds</li>
                <li>Smart contract vulnerabilities</li>
                <li>Irreversible transactions</li>
                <li>Regulatory changes</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">5. AI Agent Disclaimer</h2>
              <p className="text-slate-400 mb-4">
                The AI agent provides assistance based on the information available to it.
                AI responses should not be considered financial advice. Always verify
                transaction details and do your own research before proceeding.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">6. Limitation of Liability</h2>
              <p className="text-slate-400 mb-4">
                To the maximum extent permitted by law, wAIllet and its developers shall not
                be liable for any indirect, incidental, special, consequential, or punitive
                damages, including loss of funds, arising from your use of the service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">7. No Warranty</h2>
              <p className="text-slate-400 mb-4">
                The service is provided "as is" without warranties of any kind, either express
                or implied. We do not guarantee the service will be uninterrupted, secure,
                or error-free.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">8. Changes to Terms</h2>
              <p className="text-slate-400 mb-4">
                We may modify these terms at any time. Continued use of the service after
                changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">9. Contact</h2>
              <p className="text-slate-400 mb-4">
                For questions about these Terms, please contact us at{' '}
                <a href="mailto:legal@waillet.io" className="text-purple-400 hover:text-purple-300">
                  legal@waillet.io
                </a>
              </p>
            </section>
          </div>
        </Container>
      </Section>
    </Layout>
  )
}
