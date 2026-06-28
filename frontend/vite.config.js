import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || 'http://api.chengxvblog.top'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/uploads': {
          target,
          changeOrigin: true,
          timeout: 0,
          proxyTimeout: 300000,
        },
        '/api': {
          target,
          changeOrigin: true,
          timeout: 0,
          proxyTimeout: 300000,
        },
      },
    },
  }
})
