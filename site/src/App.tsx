import { Routes, Route } from 'react-router-dom'
import { AeoWidget } from 'aeo.js/react'
import { Home, Privacy, Terms } from './pages/index.ts'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
      <AeoWidget config={{ title: 'wAIllet - AI-Powered Crypto Wallet', url: 'https://waillet.app' }} />
    </>
  )
}

export default App
