/* global process */

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PUBLIC_PAGE_PATHS = {
  '/about': 'public/about/index.html',
  '/project': 'public/project/index.html',
  '/create': 'public/create/index.html',
  '/assets': 'public/assets/index.html',
}

function serveAboutPage() {
  return {
    name: 'serve-public-pages',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0]
        const pagePath = PUBLIC_PAGE_PATHS[pathname]
          || PUBLIC_PAGE_PATHS[pathname?.replace(/\/$/, '')]
        if (!pagePath) {
          next()
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=UTF-8')
        res.end(readFileSync(resolve(process.cwd(), pagePath), 'utf8'))
      })
    },
  }
}

// https://vite.dev/config/ — VITE_API_TARGET_DIRECT 可绕过 Cloudflare 直连后端 IP
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || 'http://api.chengxvblog.top'
  const directTarget = env.VITE_API_TARGET_DIRECT
  const apiTarget = directTarget || target

  return {
    plugins: [serveAboutPage(), react(), tailwindcss()],
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
