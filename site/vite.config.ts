import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { aeoVitePlugin } from 'aeo.js/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/waillet-mono/',
  plugins: [
    react(),
    aeoVitePlugin({
      title: 'wAIllet - AI-Powered Crypto Wallet',
      url: 'https://waillet.app',
      description: 'Your AI-Powered Crypto Guardian. Secure, intelligent wallet management with real-time risk analysis.',
    }),
  ],
})
