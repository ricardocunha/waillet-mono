import { Github, Twitter, MessageCircle } from 'lucide-react'
import { Container, Section, SectionHeader, Card } from '../ui/index.ts'

const communityLinks = [
  {
    id: 'github',
    icon: Github,
    title: 'GitHub',
    description: 'Contribute to the open-source codebase, report issues, or explore the code.',
    href: 'https://github.com/waillet/waillet',
    cta: 'View Repository',
  },
  {
    id: 'discord',
    icon: MessageCircle,
    title: 'Discord',
    description: 'Join our community to chat with other users and the team.',
    href: 'https://discord.gg/waillet',
    cta: 'Join Discord',
  },
  {
    id: 'twitter',
    icon: Twitter,
    title: 'Twitter',
    description: 'Follow us for updates, announcements, and crypto insights.',
    href: 'https://twitter.com/waillet',
    cta: 'Follow Us',
  },
]

export function Community() {
  return (
    <Section id="community">
      <Container>
        <SectionHeader
          title="Join the Community"
          subtitle="Connect with other users and stay updated on the latest developments"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {communityLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <Card hover className="h-full text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-xl bg-slate-800 group-hover:bg-purple-600/20 transition-colors">
                    <link.icon className="w-8 h-8 text-slate-400 group-hover:text-purple-400 transition-colors" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{link.title}</h3>
                <p className="text-slate-400 mb-4 text-sm">{link.description}</p>
                <span className="text-purple-400 font-medium text-sm group-hover:text-purple-300">
                  {link.cta} →
                </span>
              </Card>
            </a>
          ))}
        </div>
      </Container>
    </Section>
  )
}
