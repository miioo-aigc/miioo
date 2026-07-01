import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['chengxvblog.top', 'www.chengxvblog.top', '152.136.237.31', 'miiooai.com', 'www.miiooai.com', '129.211.162.176'],
      proxy: {
        '/uploads': { target, changeOrigin: true },
        '/api': { target, changeOrigin: true },
      },
    },
    preview: {
      host: '0.0.0.0',
    },
  }
})
