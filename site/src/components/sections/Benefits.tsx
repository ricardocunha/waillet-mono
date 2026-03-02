import { Container, Section, SectionHeader, Card, CardIcon, CardTitle, CardDescription } from '../ui/index.ts'
import { benefits } from '../../constants/content.ts'

export function Benefits() {
  return (
    <Section className="bg-slate-900/30">
      <Container>
        <SectionHeader
          title="Why Choose wAIllet"
          subtitle="Built for security, designed for simplicity"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, index) => (
            <Card key={benefit.title} hover className={`animate-fade-in-up animation-delay-${index * 100}`}>
              <CardIcon>
                <benefit.icon className="w-6 h-6 text-purple-400" />
              </CardIcon>
              <CardTitle>{benefit.title}</CardTitle>
              <CardDescription>{benefit.description}</CardDescription>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}
