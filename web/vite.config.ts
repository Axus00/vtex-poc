import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

// La API de Go corre aparte (go run ./src/cmd/api). El front la consume vía /api
// para evitar CORS: /api/search?q=x -> <API_TARGET>/search?q=x
const apiTarget = process.env.API_TARGET ?? 'http://localhost:8080'

const proxy: Record<string, ProxyOptions> = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy,
  },
  preview: {
    proxy,
  },
})
