/* global process */

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/ — VITE_API_TARGET_DIRECT 可绕过 Cloudflare 直连后端 IP
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || 'http://api.chengxvblog.top'
  const directTarget = env.VITE_API_TARGET_DIRECT
  const apiTarget = directTarget || target

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      proxy: {
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
          timeout: 0,
          proxyTimeout: 300000,
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          headers: directTarget ? { Host: new URL(target).host } : undefined,
          timeout: 0,
          proxyTimeout: 300000,
        },
      },
    },
  }
})
