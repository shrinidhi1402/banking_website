import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api/* from the Vite dev server (port 5173) to the Express backend (port 3001).
      // This means http://localhost:5173/api/bugs/secret reaches the backend rather than the SPA fallback.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
