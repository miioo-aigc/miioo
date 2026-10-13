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
    optimizeDeps: {
      // Prebuild lazy script-page dependencies before serving their module URLs.
      include: [
        'mammoth',
        'react-markdown',
        '@tiptap/react',
        '@tiptap/extension-document',
        '@tiptap/extension-paragraph',
        '@tiptap/extension-text',
        '@tiptap/extension-heading',
        '@tiptap/extension-bold',
        '@tiptap/extension-bullet-list',
        '@tiptap/extension-ordered-list',
        '@tiptap/extension-list-item',
        'tiptap-markdown',
      ],
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      proxy: {
        '^/__image-media/media/origin/': {
          target: 'https://www.chengxvblog.top',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__image-media/, ''),
          timeout: 0,
          proxyTimeout: 300000,
        },
        '^/__dev-media/media/origin/': {
          target: 'https://www.chengxvblog.top',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__dev-media/, ''),
          timeout: 0,
          proxyTimeout: 300000,
        },
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
          configure(proxy) {
            proxy.on('proxyRes', (response) => {
              response.headers['x-miioo-dev-proxy'] = 'upstream-response'
              if (response.statusCode >= 500) {
                console.warn(`[开发代理] 上游返回 ${response.statusCode}，目标 ${new URL(apiTarget).origin}`)
              }
            })
            proxy.on('error', (error) => {
              // AggregateError 的顶层堆栈不会显示各次连接的实际地址。
              const failures = error.errors?.length ? error.errors : [error]
              console.error(`[开发代理] ${new Date().toISOString()} 连接失败，目标 ${new URL(apiTarget).origin}`)
              for (const failure of failures) {
                console.error('[开发代理] 连接详情', {
                  code: failure.code || error.code || 'UNKNOWN',
                  syscall: failure.syscall,
                  address: failure.address,
                  port: failure.port,
                })
              }
            })
          },
        },
      },
    },
  }
})
