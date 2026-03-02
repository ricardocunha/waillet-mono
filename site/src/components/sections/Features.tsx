import { Container, Section, SectionHeader, Card, CardIcon, CardTitle, CardDescription } from '../ui/index.ts'
import { features } from '../../constants/content.ts'

export function Features() {
  return (
    <Section id="features" className="bg-slate-900/30">
      <Container>
        <SectionHeader
          title="Intelligent Features"
          subtitle="Everything you need for secure, effortless crypto management"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={feature.title} hover className={`animate-fade-in-up animation-delay-${index * 100}`}>
              <CardIcon>
                <feature.icon className="w-6 h-6 text-purple-400" />
              </CardIcon>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}
