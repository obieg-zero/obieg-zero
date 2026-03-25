import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

const pluginsDir = resolve(__dirname, '../plugins')

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-plugins',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const m = req.url?.match(/\/(plugin-[^/]+)\/index\.mjs$/)
          if (m) {
            const file = resolve(pluginsDir, m[1], 'index.mjs')
            if (existsSync(file)) {
              res.setHeader('Content-Type', 'text/javascript')
              res.setHeader('Cache-Control', 'no-store')
              res.end(readFileSync(file, 'utf-8'))
              return
            }
          }
          next()
        })
      },
    },
  ],
})
