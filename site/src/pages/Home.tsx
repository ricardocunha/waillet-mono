import { Layout } from '../components/layout/index.ts'
import {
  Hero,
  Features,
  HowItWorks,
  Benefits,
  Screenshots,
  Downloads,
  Community,
  FinalCTA,
} from '../components/sections/index.ts'

export function Home() {
  return (
    <Layout>
      <Hero />
      <Features />
      <HowItWorks />
      <Benefits />
      <Screenshots />
      <Downloads />
      <Community />
      <FinalCTA />
    </Layout>
  )
}
