import { Layout } from '../components/layout/index.ts'
import { Container, Section } from '../components/ui/index.ts'

export function Privacy() {
  const lastUpdated = 'March 20, 2026';

  return (
    <Layout>
      <Section>
        <Container size="md">
          <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>

          <div className="prose prose-invert prose-slate max-w-none">
            <p className="text-slate-400 text-lg mb-8">
              Last updated: {lastUpdated}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
              <p className="text-slate-400 mb-4">
                wAIllet ("we", "our", or "us") is committed to protecting your privacy. This
                Privacy Policy explains how we collect, use, and safeguard information when you
                use our browser extension and related services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">2. Self-Custody Wallet</h2>
              <p className="text-slate-400 mb-4">
                wAIllet is a self-custody wallet. This means:
              </p>
              <ul className="list-disc pl-6 text-slate-400 space-y-2">
                <li>Your private keys are stored locally on your device</li>
                <li>We do not receive your private keys or seed phrase</li>
                <li>You are responsible for securing your keys</li>
                <li>We cannot recover your wallet if you lose your seed phrase</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">3. Information We Collect</h2>
              <p className="text-slate-400 mb-4">
                We collect and process information needed to provide the service:
              </p>
              <ul className="list-disc pl-6 text-slate-400 space-y-2">
                <li><strong>On-device data:</strong> Encrypted wallet data, settings, and chat history stored locally in your browser</li>
                <li><strong>Account identifiers:</strong> Wallet address and authentication tokens needed for login</li>
                <li><strong>Transaction-related data:</strong> Public blockchain addresses, transaction parameters, and simulation requests you submit</li>
                <li><strong>AI interactions:</strong> Prompts and responses sent to our backend to process your requests</li>
                <li><strong>Service configuration:</strong> Favorites, policies, and preferences you save in the app</li>
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
              <h2 className="text-2xl font-semibold text-white mb-4">5. Sharing and Third Parties</h2>
              <p className="text-slate-400 mb-4">
                We do not sell your personal information. We may share limited data with service
                providers to operate the product, such as cloud hosting, AI processing, blockchain
                infrastructure, or content delivery networks. These providers may receive your IP
                address and request metadata as part of normal operations.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">6. Data Security</h2>
              <p className="text-slate-400 mb-4">
                We implement industry-standard security measures to protect your data.
                However, no method of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">7. Data Retention</h2>
              <p className="text-slate-400 mb-4">
                We retain data only as long as necessary to provide the service, comply with legal
                obligations, resolve disputes, and enforce agreements. You can request deletion of
                server-stored data by contacting us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">8. Children&apos;s Privacy</h2>
              <p className="text-slate-400 mb-4">
                wAIllet is not directed to children under 13, and we do not knowingly collect
                personal information from children.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">9. Changes to This Policy</h2>
              <p className="text-slate-400 mb-4">
                We may update this Privacy Policy from time to time. We will update the “Last
                updated” date above when changes are made.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">10. Contact Us</h2>
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
