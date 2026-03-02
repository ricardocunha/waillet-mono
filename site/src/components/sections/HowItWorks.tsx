import { Container, Section, SectionHeader } from '../ui/index.ts'
import { steps } from '../../constants/content.ts'

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <Container>
        <SectionHeader
          title="Get Started in Minutes"
          subtitle="Three simple steps to secure, intelligent crypto management"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`relative animate-fade-in-up animation-delay-${index * 100}`}
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-purple-600/50 to-transparent" />
              )}

              <div className="text-center">
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 border border-purple-500/30 mb-6">
                  <span className="text-2xl font-bold text-purple-400">{step.number}</span>
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-slate-400">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
