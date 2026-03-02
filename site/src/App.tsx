import { Routes, Route } from 'react-router-dom'
import { Home, Privacy, Terms } from './pages/index.ts'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
    </Routes>
  )
}

export default App
