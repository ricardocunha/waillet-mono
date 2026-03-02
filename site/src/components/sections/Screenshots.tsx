import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Container, Section, SectionHeader } from '../ui/index.ts'

const screenshotBaseUrl = `${import.meta.env.BASE_URL}screenshots/`

const screenshots = [
  {
    id: 'extension-dashboard',
    title: 'Wallet Dashboard',
    description: 'View your balances and recent activity at a glance',
    src: `${screenshotBaseUrl}extension-dashboard.png`,
  },
  {
    id: 'extension-ai',
    title: 'AI Agent',
    description: 'Chat with your wallet using natural language',
    src: `${screenshotBaseUrl}extension-ai.png`,
  },
  {
    id: 'extension-networks',
    title: 'Multi-Chain Support',
    description: 'Switch between networks seamlessly',
    src: `${screenshotBaseUrl}extension-networks.png`,
  },
  {
    id: 'extension-send',
    title: 'Send Crypto',
    description: 'Easily send tokens to any address or saved favorite',
    src: `${screenshotBaseUrl}extension-send.png`,
  },
  {
    id: 'extension-settings',
    title: 'Account Settings',
    description: 'Manage your wallet, export keys, and configure AI',
    src: `${screenshotBaseUrl}extension-settings.png`,
  },
  {
    id: 'extension-favorite',
    title: 'Save Favorites',
    description: 'Save frequently used addresses for quick access',
    src: `${screenshotBaseUrl}extension-favorite.png`,
  },
]

export function Screenshots() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? screenshots.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === screenshots.length - 1 ? 0 : prev + 1))
  }

  const current = screenshots[currentIndex]

  return (
    <Section>
      <Container>
        <SectionHeader
          title="See It In Action"
          subtitle="Experience the power of AI-assisted crypto management"
        />

        <div className="max-w-4xl mx-auto">
          {/* Main screenshot */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
            <div className="aspect-[16/10] flex items-center justify-center">
              <img
                src={current.src}
                alt={current.title}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling?.classList.remove('hidden')
                }}
              />
              <div className="hidden text-slate-600 text-center p-8">
                <div className="text-5xl mb-4">📸</div>
                <p className="text-lg">{current.title}</p>
                <p className="text-sm mt-2">Screenshot not available</p>
              </div>
            </div>

            {/* Navigation arrows */}
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-slate-800/80 rounded-full text-white hover:bg-slate-700 transition-colors"
              aria-label="Previous screenshot"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-slate-800/80 rounded-full text-white hover:bg-slate-700 transition-colors"
              aria-label="Next screenshot"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Caption */}
          <div className="text-center mt-6">
            <h3 className="text-xl font-semibold text-white mb-2">{current.title}</h3>
            <p className="text-slate-400">{current.description}</p>
          </div>

          {/* Dots navigation */}
          <div className="flex justify-center gap-2 mt-6">
            {screenshots.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-purple-500' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                aria-label={`Go to screenshot ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </Container>
    </Section>
  )
}
