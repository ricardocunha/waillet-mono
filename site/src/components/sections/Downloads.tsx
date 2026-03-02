import { Chrome, Globe } from 'lucide-react'
import { Container, Section, SectionHeader, Card, Button } from '../ui/index.ts'

const downloads = [
  {
    id: 'chrome',
    icon: Chrome,
    title: 'Chrome Extension',
    description: 'Install wAIllet on Chrome, Brave, Edge, and other Chromium browsers.',
    cta: 'Add to Chrome',
    href: '#', // Will be updated when published
    available: true,
  },
  {
    id: 'firefox',
    icon: Globe,
    title: 'Firefox Add-on',
    description: 'Install wAIllet on Firefox for secure, private browsing.',
    cta: 'Add to Firefox',
    href: '#', // Will be updated when published
    available: true,
  },
  {
    id: 'dapp',
    icon: Globe,
    title: 'Web DApp',
    description: 'Access wAIllet directly in your browser without installing anything.',
    cta: 'Launch DApp',
    href: '/dapp',
    available: true,
  },
]

export function Downloads() {
  return (
    <Section id="downloads" className="bg-slate-900/30">
      <Container>
        <SectionHeader
          title="Get wAIllet"
          subtitle="Choose your preferred way to access wAIllet"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {downloads.map((download) => (
            <Card key={download.id} hover className="text-center">
              <div className="flex justify-center mb-4">
                <div className={`p-4 rounded-xl ${download.available ? 'bg-purple-600/20' : 'bg-slate-800'}`}>
                  <download.icon className={`w-8 h-8 ${download.available ? 'text-purple-400' : 'text-slate-500'}`} />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{download.title}</h3>
              <p className="text-slate-400 mb-6 text-sm">{download.description}</p>
              <Button
                href={download.href}
                variant={download.available ? 'primary' : 'secondary'}
                className="w-full"
                disabled={!download.available}
              >
                {download.cta}
              </Button>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}
