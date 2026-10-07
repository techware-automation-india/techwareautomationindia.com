import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      'framer-motion',
      'axios',
      'sonner',
      'clsx',
      'tailwind-merge',
      'country-state-city'
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 200,
    },
    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/App.jsx'
      ]
    }
  }
})
